const express = require("express");
const path = require("path");
const app = require("express")();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const http = require("http").Server(app);
const uuid = require('uuid');
const emailjs = require('@emailjs/nodejs');
const fs = require("fs");
app.use(bodyParser());
app.use(cookieParser());

const users = new Map();
const carts = new Map();
const sessions = new Map();
const orders = new Map();
const recoveries = new Map();

const productsMap = new Map();

emailjs.init({
  publicKey: 'jvnFjiI9gOl31MQgx'
});

JSON.parse(
  fs.readFileSync("./json/products.json", "utf8")
).map((product) => productsMap.set(product.id, product));

const PORT = 3001;
const BASE_URL = 'https://e-com-shop-demo.glitch.me';

const genRanHex = (size) =>
  [...Array(size)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");

const getId = () => {
  let rnd = uuid.v4();
  // while ([...users.keys(), ...carts.keys(), ...sessions.keys(), ...recoveries.keys(), ...orders.map((order) => order.id)].includes(rnd)) {
  //   rnd = uuid.v4();
  // }
  return rnd;
};

const createRecovery = (email) => {
  const id = getId();
    recoveries.set(id, {
      id: id,
      email: email,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    })
    return id;
}

const isEmailValid = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const userToSend = (user) => {
  return {
    name: user.name,
    email: user.email,
    orders: (orders.get(user.email) || []).map((order) => orderToSend(order)),
    bonuses: user.bonuses
  }
}

const orderToSend = (order) => {
  const status = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Completed'][Math.min(Math.floor((Date.now() - order.date) / 1000 / 15), 4)];
  return {
    id: order.id,
    items: order.items,
    status: status,
    estimatedDeliveryTime: order.date + 1000 * 15 * 5,
  }
}

const getCategoryById = (id, callback) => {
  fs.readFile("./json/categories.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      callback(undefined);
      return;
    }

    try {
      const categories = JSON.parse(data);
      const category = categories.find((c) => c.id == id);

      if (category) {
        callback(category.name);
      } else {
        callback(undefined);
      }
    } catch (error) {
      console.error(error);
      callback(undefined);
    }
  });
};

app.use(express.static(__dirname + '/dist'));
app.use(express.static(__dirname + '/public'));

app.post("/api/order", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  try {
  const cookies = req.cookies;
  const email = sessions.get(cookies.sessionId);
  const user = users.get(email);
  const cartId = user ? user.cartId : cookies.cartId;
  const cart = carts.get(cartId || cookies.cartId);

  if (user && cart) {
    const currentOrders = orders.get(email) || [];
    currentOrders.push({
      id: getId(),
      items: cart.items,
      date: Date.now()
    });
    orders.set(email, currentOrders);
    let price = cart.items.map((item) => productsMap.get(item.id).price || 0).reduce((prev, x) => prev + x);
    const spendBonuses = Math.min(price * 0.5, user.bonuses);
    cart.items = [];
    carts.set(cart.id, cart);
    user.bonuses -= spendBonuses;
    user.bonuses += price * 0.05;
    users.set(user.email, user);
  }
  if (cart) {
    cart.items = [];
    carts.set(cart.id, cart);
  }
  res
  .status(200)
  .json({ message: "Success." });
} catch (error) {
  console.error(error);
  res
    .status(500)
    .json({ error: "An error occurred while processing the data." });
}


});

app.get("/api/cart", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const cookies = req.cookies;
    const email = sessions.get(cookies.sessionId);
    const user = users.get(email);
    const cartId = user ? user.cartId : cookies.cartId;
    const cart = carts.get(cartId || cookies.cartId);
    
    const options = {
      maxAge: 1000 * 3600 * 24 * 14, // Two weeks
    };
    let newCart = { id: getId(), items: [], total: 0 };
    if (user) {
      if (!user.cartId || !cart) {
        user.cartId = newCart.id;
        carts.set(user.cartId, newCart);
        users.set(cookies.userId, user);
      }
      else {
      user.cartId = cartId;
      }
      res.cookie("userId", user.id, options);
      return res.json(carts.get(user.cartId));
    } else {
      if (cart) {
        res.cookie("cartId", cart.id, options);
        return res.json(cart);
      } else {
        carts.set(newCart.id, newCart);
        res.cookie("cartId", newCart.id, options);
        return res.json(newCart);
      }
    }
    return res.status(200).json({ message: "ok" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the data." });
  }
});

app.post("/api/cart", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const cookies = req.cookies;
    const email = sessions.get(cookies.sessionId);
    const user = users.get(email);
    const cartId = (user ? user.cartId : cookies.cartId) || cookies.cartId;
    const cart = carts.get(cartId);
    console.log(cart);
    if (cart) {
      carts.set(cartId, {
        id: cookies.cartId,
        items: req.body.cart,
        total: req.body.cart.length,
      });
    }
    return res.status(200).json({ message: "ok" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the data." });
  }
});

app.post("/api/signup", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const { name, email, password } = req.body;

    if(!isEmailValid(email)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    if (Array.from(users.values()).some(user => user.email === email)) {
      return res.status(400).json({ error: "User with this email already exists." });
    }

    const newUser = {
      id: getId(),
      name: name,
      email: email,
      password: password,
      orders: [],
      bonuses: 0
    };

    users.set(email, newUser);

    const sessionId = getId();

      sessions.set(sessionId, email);

      res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 1000 * 3600 * 24 });

    return res.status(200).json({ message: "User created successfully", user: userToSend(newUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the data." });
  }
});

app.post("/api/recover", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const { id, password } = req.body;

    if(!recoveries.get(id)) {
      return res.status(400).json({ error: "Invalid recovery id." });
    }

    if(recoveries.get(id).expires < Date.now()) {
      return res.status(400).json({ error: "Recovery id has expired." });
    }

    const email = recoveries.get(id).email;

    if(!users.get(email)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const user = users.get(email);

    user.password = password;
    users.set(email, user);

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the data." });
  }
});

app.post("/api/reset", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const { email } = req.body;

    if(!isEmailValid(email)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const user = users.get(email);

    if (user) {
      const recoveryId = createRecovery(email);
      emailjs.send("service_b48eip5","template_kows8c8",{
        name: user.name,
        to: user.email,
        action_url: `${BASE_URL}/recover/${recoveryId}`,
        });
    }

    return res.status(200).json({ message: "If the user with this email exists, we'll send a password recovery email to that address." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the data." });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.get(email);
    if (user && user.password === password) {
      const sessionId = getId();

      sessions.set(sessionId, user.email);

      res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 1000 * 3600 * 24 });

      return res.status(200).json({ message: "Login successful", user: userToSend(user) });
    } else {
      return res.status(401).json({ error: "Invalid email or password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the data." });
  }
});

app.post("/api/logout", (req, res) => {
  const sessionId = req.cookies.sessionId;

  if (sessionId) {
    sessions.delete(sessionId);

    res.cookie('sessionId', '', { expires: new Date(0) });

    return res.status(200).json({ message: "Logout successful" });
  } else {
    return res.status(400).json({ error: "No session found" });
  }
});

app.get("/api/user", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized: No sessionId provided." });
    }

    const email = sessions.get(sessionId);

    if (!email) {
      res.clearCookie('sessionId');
      return res.status(401).json({ error: "Unauthorized: Invalid sessionId." });
    }

    const user = users.get(email);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({ user: userToSend(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing the data." });
  }
});


app.get("/api/products/:id", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  const { id } = req.params;

  console.log("Received request: single product.");

  fs.readFile("./json/products.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "An error occurred while reading the data." });
    }

    try {
      const products = JSON.parse(data);

      const product = products.find((item) => item.id == id);

      if (!product) {
        return res.status(404).json({ error: "Product not found." });
      }

      res.json(product);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the data." });
    }
  });
});

app.get("/api/products", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  console.log("Received request: products.");

  fs.readFile("./json/products.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "An error occurred while reading the data." });
    }

    try {
      const substring = (req.query.substring || "").toLowerCase();
      const products = JSON.parse(data).filter((p) => {
        return (
          p.title.toLowerCase().includes(substring) ||
          p.subtitle.toLowerCase().includes(substring)
        );
      });

      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || products.length;
      const include = String(req.query.include || "").split("|");

      const categoryNames = [];
      const categoriesData = JSON.parse(
        fs.readFileSync("./json/categories.json", "utf8")
      );

      if (!req.query.include || req.query.include == "") {
        const paginatedProducts = products.slice(offset, offset + limit);
        res.json({ products: paginatedProducts, total: products.length });
        return;
      }

      include.forEach((id) => {
        const cur = categoriesData.find((c) => c.id == id);
        if (cur) {
          categoryNames.push(cur.name);
        }
      });
      const filteredProducts = products.filter((p) =>
        categoryNames.includes(p.category)
      );
      const paginatedProducts = filteredProducts.slice(offset, offset + limit);
      res.json({ products: paginatedProducts, total: filteredProducts.length });
      return;
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the data." });
    }
  });
});

app.get("/api/categories", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  console.log("Received request: categories.");

  fs.readFile("./json/categories.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "An error occurred while reading the data." });
    }

    try {
      const categories = JSON.parse(data);

      res.json({ categories: categories });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the data." });
    }
  });
});

app.get("/api/categories/:id", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  const { id } = req.params;

  console.log("Received request: single category.");

  fs.readFile("./json/categories.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "An error occurred while reading the data." });
    }

    try {
      const categories = JSON.parse(data);

      const category = categories.find((item) => item.id == id);

      if (!category) {
        return res.status(404).json({ error: "Category not found." });
      }

      res.json(category);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the data." });
    }
  });
});

app.get('*', function(req, res) {
  res.sendfile(__dirname + '/dist/index.html');
});

http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`);
});
