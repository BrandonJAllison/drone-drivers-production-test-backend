require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const stripe = require('stripe')('sk_test_51MfvqQDhepDNpjvl1L9gLRfSQuj6cAIaFE0MYUCuAl5qaIlh4rci9mql1M6bYkzFbGOXnA6QUnFC5N5Mk36ua6Pp00iyG3VKPJ');

const app = express();
app.use(cors());
const port = process.env.PORT || 3001;

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error(err));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String, required: true, unique: true }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) { return next(); }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, username } = req.body;
    const userExists = await User.exists({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email or username already exists.' });
    }
    const user = new User({ email, password, firstName, lastName, username });
    await user.save();
    req.session.userId = user._id;
    res.json({ message: 'User signed up and authenticated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      const passwordIsValid = await bcrypt.compare(password, user.password);
      if (!passwordIsValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
      res.json({ firstName: user.firstName, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  });
  const server = require('http').createServer(app);
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', (socket) => {
    socket.on('message', async (message) => {
      try {
        const session = await stripe.checkout.sessions.create(/* ... */);
        socket.send(JSON.stringify({ id: session.id }));
      } catch (err) {
        console.error(err);
        socket.send(JSON.stringify({ error: err.message }));
      }
    });
  });
  
  app.post('/create-checkout-session', (req, res) => {
    const socket = new WebSocket('ws://sea-turtle-app-l7rbe.ondigitalocean.app//create-checkout-session');
    socket.on('open', () => {
      socket.send('create session');
    });
    socket.on('message', (message) => {
      const data = JSON.parse(message);
      if (data.id) {
        res.json({ id: data.id });
      } else {
        res.status(500).json({ message: data.error });
      }
    });
  });
  app.get('/success', (req, res) => {
    res.send('Success!');
  });
  
  app.get('/cancel', (req, res) => {
    res.send('Cancelled!');
  });
  server.listen(port, () => console.log(`Server listening on port ${port}`));
  