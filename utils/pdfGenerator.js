const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const QRCode = require('qrcode');
const fs = require('fs');

const formatCurrency = (value) => {
  if (!value) return '0.00';
  const num = parseFloat(value);
  return num.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = ('' + phone).replace(/\D/g, '');
  return cleaned.length === 10 ? cleaned.replace(/(\d{5})(\d{5})/, '$1 $2') : phone;
};

// Load hamburger/soda icon as base64 (replace with your image path)
const getHamburgerSodaIcon = () => {
  try {
    // Replace './path/to/hamburgersoda.png' with the actual path to your image
    const imagePath = './public/images/hamburgersoda.png';
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error loading hamburger/soda icon:', error);
    return null; // Fallback if image is missing
  }
};

// Load hamburger/soda icon as base64 (replace with your image path)
const getpaidIcon = () => {
  try {
    // Replace './path/to/hamburgersoda.png' with the actual path to your image
    const imagePath = './public/images/paid.png';
    const imageBuffer = fs.readFileSync(imagePath);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error loading hamburger/soda icon:', error);
    return null; // Fallback if image is missing
  }
};


// Generate QR code as data URL
const generateQRCode = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      width: 150, // Match JSX (150px)
      margin: 1,
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Function to generate PDF document definition
  const generateInvoiceDocument = async (order = {}, products = []) => {
    const totalAmount = order.amount || 0;
    const qrCodeDataUrl = order.orderid ? await generateQRCode(order.orderid) : null;
    const hamburgerSodaIcon = getHamburgerSodaIcon();
    const paidIcon = getpaidIcon();

    const docDefinition = {
      pageSize: { width: 393, height: 1700 },
      pageMargins: [8, 8, 8, 8], // Match p-3 (~12px), optimized for mobile
      content: [
        {
          stack: [
            // Header: Apsara Cinemas
            {
              text: 'Apsara Theatre',
              style: 'header',
              alignment: 'center',
              margin: [0, 12, 0, 4], // mt-3, mt-1
            },
            {
              columns: [
                {
                  image: hamburgerSodaIcon,
                  alignment:'right',
                  margin: [0, 0, 4, 0]
                },
                { text: 'Order Summary',
                  style: 'subheader',
                  alignment: 'left',
                },
              ],
              margin: [0, 0, 50, 20], // mt-5
              width: '100%',
            },
            {
              columns: [
                {
                  text: `Date: ${order.date ? new Date(order.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''}`,
                  style: 'normal',
                  alignment: 'left',
                },
                {
                  text: `Ph: ${order.phoneNumber ? formatPhoneNumber(order.phoneNumber) : ''}`,
                  style: 'normal',
                  bold: true,
                  alignment: 'right',
                },
              ],
              margin: [0, 0, 0, 20], // mt-5
              width: '100%',
            },
            // Time
            {
              text: `Time: ${order.time || ''}`,
              style: 'normal',
              alignment: 'left',
              margin: [0, 0, 0, 16], // mt-5, mt-4
            },
            // Table Header
            {
              table: {
                widths: ['50%', '12%', '15%', '23%'], // Sum to 400px
                body: [
                  [
                    { text: 'Items', style: 'tableHeader', alignment:'left' },
                    { text: 'Qty', style: 'tableHeader', alignment: 'center' },
                    { text: 'Rate', style: 'tableHeader', alignment: 'center' },
                    { text: 'Amount', style: 'tableHeader', alignment: 'center' },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 2,
                vLineWidth: () => 0,
                hLineColor: () => '#000000',
                paddingTop: () => 12,
                paddingBottom: () => 12,
                hLineStyle: () => ({ dash: { length: 4, space: 2 } }), // Match border-dashed
              },
              margin: [0, 16, 0, 0], // mt-4
            },
            // Table Body
            {
              table: {
                widths: ['50%', '12%', '15%', '23%'],
                body: products.length
                  ? products.map(item => [
                      {
                        stack: [
                          { text: item.productname || 'Item', style: 'tableBody',alignment: 'left' },
                          item.description && item.description !== ''
                            ? { text: `(${item.description})`, style: 'tableDescription', alignment: 'left' }
                            : {},
                        ],
                      },
                      { text: item.qty || 1, style: 'tableBody', alignment: 'center' },
                      { text: `₹ ${item.price || '0.00'}`, style: 'tableBody', alignment: 'center' },
                      { text: `₹ ${formatCurrency((item.price || 0) * (item.qty || 1))}`, style: 'tableBody', alignment: 'center' },
                    ])
                  : [[{ text: 'No items', style: 'tableBody', colSpan: 4, alignment: 'center' }, {}, {}, {}]],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                hLineColor: () => '#000000',
                paddingTop: () => 8,
                paddingBottom: () => 8,
              },
            },
            // Total
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: [
                        { text: 'Total', style: 'tableHeader', bold: true },
                        { text: ' ₹ ', style: 'tableHeader', bold: true, margin: [24, 0, 0, 0] },
                        { text: formatCurrency(totalAmount), style: 'totalAmount', bold: true },
                      ],
                      alignment: 'right',
                    },
                  ],
                ],
              },
              margin: [0, 8, 0, 0], // mt-2
              layout: {
                hLineWidth: () => 2,
                vLineWidth: () => 0,
                hLineColor: () => '#000000',
                paddingTop: () => 12,
                paddingBottom: () => 12,
                hLineStyle: () => ({ dash: { length: 4, space: 2 } }), // Match border-dashed
              },
            },
            // Order Number
            {
              text: [
                { text: 'Order No: ', style: 'normal', bold: true },
                { text: `# ${order.orderno || ''}`, style: 'orderNo' },
              ],
              alignment: 'center',
              margin: [0, 12, 0, 8], // mt-3
            },
            {
              table: {
                widths: ['8%' , '22%', '71%',], 
                body: [
                  [
                    { text: '' },
                    { image: paidIcon , style: 'tableHeader', alignment:'left',margin: [0, 0, 0, 40]  },
                    { image: qrCodeDataUrl , style: 'tableHeader', alignment:'left' },
                  ],
                ],
              },
              margin: [0, 4, 0, 0], 
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                hLineColor: () => '#000000',
                paddingTop: () => 8,
                paddingBottom: () => 8,
              },
            },
            {
              text: 'Your order is being prepared in 15-20 mins.',
              style: 'normal',
              alignment: 'center',
              margin: [0, 40, 0, 0], // mt-10
            },
            {
              text: 'We will contact you when the food is ready.',
              style: 'normal',
              alignment: 'center',
              margin: [0, 10, 0, 0], // mt-10
            },
          ],
          width: 200, // Max width 400px
          alignment: 'center',
          border: [1, 1, 1, 1],
          borderColor: '#E8DFE0',
        },
      ],
      styles: {
        header: {
          fontSize: 24, // Match text-[24px]
          color: '#CB202D',
          bold: true,
        },
        subheader: {
          fontSize: 12, // Match text-[12px]
          color: '#CB202D',
        },
        normal: {
          fontSize: 14, // Match text-[14px]
          color: '#000000',
        },
        tableHeader: {
          fontSize: 14, // Match text-[14px]
          color: '#000000',
          bold: true,
        },
        tableBody: {
          fontSize: 16, // Match text-[16px]
          color: '#000000',
          bold: true,
        },
        tableDescription: {
          fontSize: 12, // Match text-[12px]
          color: '#000000',
          bold: true,
        },
        totalAmount: {
          fontSize: 26, // Match text-[26px]
          color: '#000000',
          bold: true,
        },
        orderNo: {
          fontSize: 18, // Match text-[18px]
          color: '#CB202D',
          bold: true,
        },
        button: {
          fontSize: 16, // Match text-[16px]
          color: '#FFFFFF',
          bold: true,
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    return docDefinition;
  };

module.exports = { generateInvoiceDocument };