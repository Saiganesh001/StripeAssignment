// server.js (Backend)

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
  
// Connect to the first MongoDB database for subscription plans
const plansDB_URI = 'mongodb://127.0.0.1:27017/plans_database';
mongoose.connect(plansDB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to Subscription Plans MongoDB'))
  .catch(error => console.error('Subscription Plans MongoDB connection error:', error));


app.use(bodyParser.json());
app.use(cors());



// Create Mongoose models for the subscription plans and user login information
const Plan = mongoose.model('Plan', new mongoose.Schema({
  name: String,
  duration: String,
  devices: [String],
  price: Number, // 'price' field as an integer
  quality: String // 'quality' field as a string
}), 'plans'); // 'plans' is the collection name for subscription plans

// Create a Mongoose model for the user registration details
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  creditCard: {
	cardNumber: { type: String, required: false },
	expiryDate: { type: String, required: false },
	cvv: { type: String, required: false }
  },
  plan: {
	name: { type: String, required: false },
	price: { type: Number, required: false },
	billingCycle: { type: String, required: false }
  }
}));


// Sample subscription plan data with 'devices', 'price', and 'quality' fields
const samplePlans = [
  { name: 'Basic', duration: 'Yearly', devices: ['Mobile', 'Tablet'], price: 100, quality: 'Standard' },
  { name: 'Premium', duration: 'Yearly', devices: ['Mobile', 'Tablet', 'Laptop'], price: 200, quality: 'High' },
  { name: 'Pro', duration: 'Monthly', devices: ['Mobile'], price: 30, quality: 'Medium' },
  { name: 'Enterprise', duration: 'Monthly', devices: ['Mobile', 'Tablet', 'Laptop', 'Desktop'], price: 500, quality: 'Ultra' },
  // Add more plans as needed
];


const insertSamplePlans = async () => {
  try {
    // Check if sample plans already exist in the database
    const existingPlans = await Plan.find({});
    if (existingPlans.length === 0) {
      // Insert the sample plans if they are not already present
      await Plan.insertMany(samplePlans);
      console.log('Sample plans inserted to the database');
    } else {
      console.log('Sample plans already exist in the database. Skipping insertion.');
    }
  } catch (error) {
    console.error('Error inserting plans:', error);
  }
};

insertSamplePlans(); // Call the function to insert sample plans during server startup

// API route to handle user registration
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Save the user registration details to the database
    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});


// API route to handle user login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user exists in the database
    const user = await User.findOne({ email, password });

    if (user) {
      res.json({ success: true, message: 'Login successful.' });
    } else {
      res.json({ success: false, message: 'Invalid email or password.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});


// API route to get subscription plans based on duration
app.get('/api/plans', (req, res) => {
  const { duration } = req.query;

  const filteredPlans = samplePlans.filter(plan => plan.duration === duration);
  res.json(filteredPlans);
});



// Route to fetch the user's credit card details
app.get('/api/creditcard', async (req, res) => {
  try {
    // Check if the user is authenticated and get the user ID
    const userId = req.user.id; // This assumes you are using authentication middleware to store the user information in the request object

    // Find the user in the database and return their credit card details
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ creditCard: user.creditCard });
  } catch (error) {
    console.error('Error fetching credit card details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to handle credit card details submission
app.post('/api/creditcard', async (req, res) => {
  const { cardNumber, expiryDate, cvv, name, price, duration } = req.body;
	console.log(req.body);
  try {
    // Check if the user is authenticated and get the user ID
	//console.log(req);
    const userId = req.body.email; // This assumes you are using authentication middleware to store the user information in the request object
	//console.log(userId);
    // Find the user in the database and update their credit card details
    const user = await User.findOneAndUpdate(
      { email: userId },
      { $set: { 'creditCard.cardNumber': cardNumber, 'creditCard.expiryDate': expiryDate, 'creditCard.cvv': cvv,
		'plan.name': name, 'plan.price': price, 'plan.billingCycle': duration }},
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Credit card details saved successfully' });
  } catch (error) {
    console.error('Error saving credit card details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// API endpoint to cancel the plan and delete credit card details
app.post('/api/cancelplan', (req, res) => {
  const queryParams = req.body;

  // Find the user by email and delete their credit card details
  User.findOne({ email: queryParams.email })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if the user has credit card details associated
      if (!user.plan) {
        return res.status(400).json({ message: 'User does not have a plan' });
      }
	
	  // Update the user's credit card reference to null
	  user.plan = undefined;
	  user.save()
		.then(updatedUser => {
		  res.json({ message: 'Plan cancelled successfully' });
		})
		.catch(error => {
		  console.error('Error updating user plan reference:', error);
		  res.status(500).json({ message: 'Error updating user plan reference' });
		});

    })
    .catch(error => {
      console.error('Error finding user:', error);
      res.status(500).json({ message: 'Error finding user' });
    });
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
