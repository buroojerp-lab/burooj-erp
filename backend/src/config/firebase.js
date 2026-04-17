// config/firebase.js
let admin = null;

const initializeFirebase = () => {
  if (!process.env.FIREBASE_PROJECT_ID) {
    require('../config/logger').warn('Firebase not configured — push notifications disabled');
    return;
  }

  try {
    admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    require('../config/logger').info('Firebase initialized');
  } catch (err) {
    require('../config/logger').error('Firebase init failed:', err.message);
  }
};

const sendPushNotification = async ({ token, title, body, data = {} }) => {
  if (!admin) return;
  try {
    await admin.messaging().send({ token, notification: { title, body }, data });
  } catch (err) {
    require('../config/logger').error('Push notification failed:', err.message);
  }
};

const sendToTopic = async ({ topic, title, body }) => {
  if (!admin) return;
  try {
    await admin.messaging().sendToTopic(topic, { notification: { title, body } });
  } catch (err) {
    require('../config/logger').error('Topic notification failed:', err.message);
  }
};

module.exports = { initializeFirebase, sendPushNotification, sendToTopic };
