const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const adminController = require('./controllers/adminController');
const isAdminAuthenticated = require('./isAdminAuthenticated');

const app = express();
const port = 3000;
// At the beginning of your server file


// Configure Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  genid: (req) => uuidv4(),
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true
}));

// Set up MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'newfiifi',
  password: 'passwordjames',
  database: 'e_pharmacy'
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Sample healthItems and vitaminItems arrays
const healthItems = [
  { id: 1, name: 'Health Product 1', price: 30, imageUrl: 'images/p-1.jpg' },
  // Add more health items
];

const vitaminItems = [
  { id: 1, name: 'Vitamin Product 1', price: 20, imageUrl: 'images/p-6.jpg' },
  // Add more vitamin items
];

app.use((req, res, next) => {
  if (req.session.user_id) {
    res.locals.user = req.session.user_id;
  }
  
  // Pass the session variable to the templates
  res.locals.session = req.session;

  next();
});




app.get('/', (req, res) => {
  res.render('home', { session: req.session, healthItems: healthItems ,
    vitaminItems:
    vitaminItems  });
});


app.get('/login', (req, res) => {
  res.render('login', { session: req.session });
});

app.get('/register', (req, res) => {
  res.render('register', { session: req.session });
});

// Registration logic
app.post('/register', async (req, res) => {
  const { username, email, password, cpassword } = req.body;

  if (password === cpassword) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const checkQuery = 'SELECT * FROM users WHERE email = ?';
      db.query(checkQuery, [email], async (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
          const insertQuery = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
          await db.query(insertQuery, [username, email, hashedPassword]);

          res.redirect('/login'); // Redirect the user to the login page after successful registration
        } else {
          res.send('<script>alert("Woops! Email Already Exists."); window.location="/register";</script>');
        }
      });
    } catch (err) {
      console.error('Error registering user:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.send('<script>alert("Password Not Matched."); window.location="/register";</script>');
  }
});


// Login logic
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, result) => {
      if (err) throw err;

      if (result.length > 0) {
        const passwordMatch = await bcrypt.compare(password, result[0].password);

        if (passwordMatch) {
          req.session.username = result[0].username;
          req.session.user_id = result[0].id; // Set the user_id in the session
          res.redirect('/');
        } else {
          res.send('<script>alert("Woops! Email or Password is Wrong."); window.location="/login";</script>');
        }
      } else {
        res.send('<script>alert("Woops! Email or Password is Wrong."); window.location="/login";</script>');
      }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/verify', (req, res) => {
  res.render('verify'); // Render the verification page
});

app.post('/verify', async (req, res) => {
  const { verificationCode } = req.body;

  // Check if the verification code matches the one stored in the database
  const userId = req.session.user_id;
  const verifyQuery = 'SELECT verification_code FROM users WHERE id = ?';
  const [user] = await db.query(verifyQuery, [userId]);

  if (user && user.verification_code === verificationCode) {
    // Update the user's account status to verified
    const updateStatusQuery = 'UPDATE users SET is_verified = true WHERE id = ?';
    await db.query(updateStatusQuery, [userId]);

    res.redirect('/login'); // Redirect to the login page after successful verification
  } else {
    res.render('verify', { error: 'Invalid verification code' });
  }
});


// Online Buy route
app.get('/online_buy', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }
  // Fetch medicines data from the database
  const query = 'SELECT * FROM medicines'; // Update with your table name
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching medicines:', error);
      res.status(500).send('Internal Server Error');
      return;
    }

    const medicines = results; // Assuming results is an array of medicine objects

    // Render the EJS template and pass the medicines data and session
    res.render('online_buy', { medicines, session: req.session });
  });
});

app.get('/view_details/:id', (req, res) => {
  const itemId = req.params.id;

  // Fetch the item details from the database based on the itemId
  const getItemDetailsQuery = 'SELECT * FROM medicines WHERE id = ?';
0
  db.query(getItemDetailsQuery, [itemId], (err, results) => {
    if (err) {
      console.error('Error fetching item details:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (results.length === 0) {
      // Handle case where no item with the specified ID was found
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemDetails = results[0];

    // Render the item details view and pass the item details
    res.render('item_details', { itemDetails });
  });
});


// Function to fetch item details from the database
function getItemDetailsById(itemId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM items WHERE id = ?'; // Adjust the query based on your database structure
    db.query(sql, [itemId], (error, results) => {
      if (error) {
        reject(error);
        return;
      }

      if (results.length > 0) {
        resolve(results[0]);
      } else {
        resolve(null); // Item not found
      }
    });
  });
}



app.get('/profile', (req, res) => {
  // Check if the user is authenticated
  if (!req.session.user_id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Retrieve user profile information from the database using their user_id
  const userId = req.session.user_id;
  const sql = 'SELECT * FROM users WHERE id = ?';
  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('Error retrieving profile:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (result.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    // Pass the user's profile information to the profile template
    const userProfile = {
      username: result[0].username,
      email: result[0].email,
      // Add other profile information here
    };

    res.render('profile', { user: userProfile });
  });
});

  

// Your Orders route
app.get('/your_orders', (req, res) => {
  if (!req.session.username) {
    res.redirect('/login'); // User is not logged in, redirect to login page
    return;
  }

  const userId = req.session.user_id;
  const ordersQuery = 'SELECT * FROM orders WHERE user_id = ?';

  db.query(ordersQuery, [userId], (err, orders) => {
    if (err) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Render the "your_orders" view and pass orders data and session
    res.render('your_orders', { orders, session: req.session });
  });
});


// Handle search request
app.get('/search', (req, res) => {
  const query = req.query.query;

  // Check if the query is not empty
  if (!query) {
    return res.render('search', { searchResults: [] });
  }

  // Implement your search logic here (e.g., querying the database)
  const searchQuery = 'SELECT * FROM medicines WHERE name LIKE ?';
  const searchTerm = `%${query}%`; // To perform a partial match

  db.query(searchQuery, [searchTerm], (err, results) => {
    if (err) {
      console.error('Error executing search query:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const searchResults = results;

    res.render('search', { searchResults });
  });
});




  // Call Doctor route
app.get('/call_doctor', (req, res) => {
    // Render the "Call Doctor" page
    res.render('call_doctor', { session: req.session });
  });
  
  app.get('/medicine', (req, res) => {
    if (!req.session.username) {
      return res.redirect('/login');
    }
    // Fetch the medicines data from your database
    const fetchMedicinesQuery = 'SELECT * FROM medicines'; // Adjust this query as needed
    db.query(fetchMedicinesQuery, (err, medicines) => {
      if (err) {
        console.error('Error fetching medicines:', err);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }
  
      res.render('medicine', { medicines,session: req.session }); // Pass the medicines data to the template
    });
  });

  app.post('/add_to_cart', (req, res) => {
    const { image, name, price, quantity } = req.body;
  
    // Convert price and quantity to numbers
    const numericPrice = parseFloat(price);
    const numericQuantity = parseInt(quantity);
  
    // Create a cart or add to an existing cart in the session
    if (!req.session.cart) {
      req.session.cart = [];
    }
    req.session.cart.push({ image, name, price: numericPrice, quantity: numericQuantity });
  
  
    res.redirect('/cart');
  });
  

  
  
  app.get('/cart', (req, res) => {
    res.render('cart', { session: req.session, calculateTotalPrice: calculateTotalPrice });
  });
  
  // Add a new route to remove an item from the cart
app.get('/remove_from_cart/:itemName', (req, res) => {
    const itemName = req.params.itemName;
  
    // Find the index of the item in the cart by its name
    const itemIndex = req.session.cart.findIndex(item => item.name === itemName);
  
    if (itemIndex !== -1) {
      // Remove the item from the cart
      req.session.cart.splice(itemIndex, 1);
    }
  
    // Redirect back to the cart page
    res.redirect('/cart');
  });


  app.get('/checkout', (req, res) => {
    if (!req.session.username) {
      return res.redirect('/login');
    }
    // Render the checkout view and pass the session data
    res.render('checkout', { session: req.session, calculateTotalPrice: calculateTotalPrice });
  });

   
app.get('/place_order', (req, res) => {
  // Check if the user is logged in
  if (!req.session.username) {
    return res.redirect('/login'); // Redirect to the login page if not logged in
  }

  // Get the user's ID from the session
  const userId = req.session.user_id; // Update this based on your session structure

  // Calculate the total price of items in the cart
  const totalAmount = calculateTotalPrice(req.session.cart); // Implement this function

  // Create an order entry in the database
  const createOrderQuery = 'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)';
  db.query(createOrderQuery, [userId, totalAmount, 'pending'], (err, result) => {
    if (err) {
      console.error('Error creating order:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Get the ID of the newly inserted order
    const orderId = result.insertId;

    // Create order items entries in the database
    const cartItems = req.session.cart;
    const createOrderItemsQuery = 'INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)';
    cartItems.forEach(item => {
      db.query(createOrderItemsQuery, [orderId, item.product_id, item.quantity], (err) => {
        if (err) {
          console.error('Error creating order items:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });
    });

    // Clear the user's cart
    req.session.cart = [];

    // Redirect to an order confirmation page
    res.render('order_confirmation', { session: req.session });
  });
});

function calculateTotalPrice(cart) {
  let total = 0;

  if (cart && cart.length > 0) {
    for (const item of cart) {
      const price = parseFloat(item.price); // Convert price to a float
      const quantity = parseInt(item.quantity); // Convert quantity to an integer

      if (!isNaN(price) && !isNaN(quantity)) {
        total += price * quantity;
      } else {
        console.log(`Invalid price or quantity for item: ${item.name}`);
      }
    }
  }

  return total.toFixed(2); // Convert total to a string with 2 decimal places
}


  // Online Buy route
  app.get('/online_buy', (req, res) => {
    if (!req.session.username) {
      return res.redirect('/login');
    }
    // Render the "Online Buy" page
    res.render('online_buy', { session: req.session });
  });
  
  // Lab Test route
  app.get('/lab_test', (req, res) => {
    if (!req.session.username) {
      return res.redirect('/login');
    }
    // Render the "Lab Test" page
    res.render('lab_test', { session: req.session });
  });
  
  // Contact Us route
  app.get('/contact_us', (req, res) => {
    if (!req.session.username) {
      return res.redirect('/login');
    }
    // Render the "Contact Us" page
    res.render('contact_us', { session: req.session });
  });
  
  
// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      res.status(500).json({ error: 'Failed to log out' });
    } else {
      res.redirect('/'); // Redirect to login page after logout
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});














