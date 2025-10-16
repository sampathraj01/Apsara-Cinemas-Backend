const admin = require('firebase-admin');
const { firebaseConfig1 } = require('./firebaseConfig');

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig1)
});

const messaging = admin.messaging();

async function sendPush(order, pdfUrl, fcmToken) { // fcmToken from client
  const message = {
    token: fcmToken,
    notification: {
      title: 'New Order received',
      body: `Order #${order.orderno} - ₹${order.amount}`,
    },
    data: { // Custom data
      invoiceUrl: pdfUrl,
      orderId: order.orderid
    }
  };

  try {
    const response = await messaging.send(message);
    console.log('Success:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage in your Lambda
module.exports.sendPaymentSuccessNotification = async (order, pdfUrl, fcmToken) => {
  await sendPush(order, pdfUrl, fcmToken);
};