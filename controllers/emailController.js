import nodemailer from "nodemailer";

export const sendMail = async (req, res) => {
    const {
        name,
        email,
        phone,
        message,
        product_name,
        prod_id,
    } = req.body;

    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            port: 465,
            secure: true, // ⚡ SSL for port 465
            auth: {
                user: "info@fhgeneralequipment.com",
                pass: "FHg@$$@123",
            },
            tls: {
                rejectUnauthorized: false,
            },
        });


        // If product details exist => Product inquiry email
        const isProductInquiry = product_name && prod_id;

        const subject = isProductInquiry
            ? `Product Inquiry: ${product_name} (ID: ${prod_id})`
            : `New Contact Form Message`;

        const html = isProductInquiry
            ? `
        <h3>New Product Inquiry</h3>
        <p><strong>Product Name:</strong> ${product_name}</p>
        <p><strong>Product ID:</strong> ${prod_id}</p>
        <hr />
        <p><strong>Full Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong> ${message}</p>
      `
            : `
        <h3>New General Contact Message</h3>
        <p><strong>Full Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong> ${message}</p>
      `;

        await transporter.sendMail({
            from: `"FH General Equipment" <info@fhgeneralequipment.com>`,
            to: "info@fhgeneralequipment.com",
            subject,
            html,
        });

        res.json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
        console.error("Email Error:", error);
        res.status(500).json({ success: false, message: "Failed to send email" });
    }
};
