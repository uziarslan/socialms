if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}

const express = require('express');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const MongoDBStore = require('connect-mongo');
const session = require('express-session');
const path = require('path');
const ejsMate = require('ejs-mate');
const homeRoute = require('./routes/homeRoute');
const ExpressError = require('./utils/ExpressError');
const mongoose = require('mongoose')
const app = express();
const port = 3001;
const mongoURi = process.env.MONGO_URI

const secret = 'goodsecret'

const store = new MongoDBStore({
  mongoUrl: mongoURi,
  secret,
  touchAfter: 24 * 60 * 60
});
const sessionConfig = {
  store,
  secret,
  name: "session",
  resave: false,
  saveUninitialized: false
};

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set(path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));

// Use sessions to persist login sessions
app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Define the Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.APP_ID,
  clientSecret: process.env.APP_SECRET,
  callbackURL: 'http://localhost:3001/home'
}, (accessToken, refreshToken, profile, done) => {
  console.log(accessToken);
  const user = { id: profile.id, displayName: profile.displayName };
  return done(null, user);
}));
// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});
// Deserialize user from session
passport.deserializeUser((id, done) => {

  const user = { id: id, displayName: 'User' };
  done(null, user);
});
// ...

mongoose.connect(mongoURi, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  console.log('Mongoose is connected')
}).catch((e) => {
  console.log(e)
});



app.get('/auth/facebook', passport.authenticate('facebook'));

app.use(homeRoute);

app.all('*', (req, res, next) => {
  next(new ExpressError('Page not found', 404));
});

app.use((err, req, res, next) => {
  const { status = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong!";
  res.status(status).render('error', { err });
});

// Start the server 
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
