const express = require("express");
const path = require("path");
const app = require("express")();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const http = require("http").Server(app);
const fs = require("fs");
app.use(bodyParser());
app.use(cookieParser());

const users = new Map();
const carts = new Map();

const PORT = 3001;

const genRanHex = (size) =>
  [...Array(size)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");

const getId = () => {
  let rnd = genRanHex(32);
  while ([...users.keys(), ...carts.keys()].includes(rnd)) {
    rnd = genRanHex(32);
  }
  return rnd;
};

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

app.get("/api/cart", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");

  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const cookies = req.cookies;
    const user = users.get(cookies.userId);
    const cart = user ? carts.get(user.cartId) : carts.get(cookies.cartId);
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
      res.cookie("userId", user.id, options);
      res.cookie("cartId", user.cartId, options);
      return res.json(carts.get(user.cartId));
    } else {
      console.log(cart);
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
    const cart = carts.get(cookies.cartId);
    console.log(req.body.cart);
    if (cart) {
      carts.set(cookies.cartId, {
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

http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`);
});
