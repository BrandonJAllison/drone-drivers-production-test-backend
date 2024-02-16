require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  // Configure CORS options as needed for your project
  // For development, you might allow all origins or specify your frontend development server
  origin: '*', // Adjust according to your frontend server
}));

const port = process.env.PORT || 3001;

// Route for creating a Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Drone Drivers Part 107 Course',
            // Add more product details here if necessary
          },
          unit_amount: 13900, // Price in cents, adjust as needed
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://app.dronedriver.com/profile',
      cancel_url: 'http://app.dronedriver.com/profile',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error in creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => console.log(`Server listening on port ${port}`))