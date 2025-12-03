import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendMail = async (req, res) => {
    const { name, email, phone, message, product_name, prod_id } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });

        const isProductInquiry = product_name && prod_id;

        const subject = isProductInquiry
            ? `Product Inquiry: ${product_name} (ID: ${prod_id})`
            : `New Message from Website`;

        const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px;">
            <h2 style="color:#0A5A62;">${isProductInquiry ? "Product Inquiry" : "Contact Message"}</h2>

            ${isProductInquiry ? `
                <p><strong>Product Name:</strong> ${product_name}</p>
                <p><strong>Product ID:</strong> ${prod_id}</p>
                <hr />
            ` : ""}

            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Message:</strong><br>${message}</p>

            <br>
            <small>Sent from FH General Equipment Website</small>
        </div>
        `;

        await transporter.sendMail({
            from: `"FH General Equipment" <${process.env.SMTP_USER}>`,
            to: process.env.EMAIL_RECEIVER,
            replyTo: email,
            subject,
            html,
        });

        res.json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
        console.error("Email Error:", error);
        res.status(500).json({ success: false, message: "Failed to send email" });
    }
};
