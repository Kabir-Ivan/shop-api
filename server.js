const express = require('express');
const path = require('path');
const app = require('express')();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const fs = require('fs');

app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
  
    fs.readFile('./json/products.json', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'An error occurred while reading the data.' });
      }
  
      try {
        const products = JSON.parse(data);
  
        const product = products.find(item => item.id == id);
  
        if (!product) {
          return res.status(404).json({ error: 'Product not found.' });
        }
  
        res.json(product);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing the data.' });
      }
    });
});

app.get('/api/products', (req, res) => {
    // Read the content of products.json
    fs.readFile('./json/products.json', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'An error occurred while reading the data.' });
      }
  
      try {
        const products = JSON.parse(data);
  
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || products.length;
  
        const paginatedProducts = products.slice(offset, offset + limit);
  
        res.json(paginatedProducts);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing the data.' });
      }
    });
});

app.get('/api/categories', (req, res) => {
    fs.readFile('./json/categories.json', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'An error occurred while reading the data.' });
      }
  
      try {
        const categories = JSON.parse(data);
  
        res.json(categories);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing the data.' });
      }
    });
  });



http.listen(80, function () {

    console.log('listening on *:80');

});