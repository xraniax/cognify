import nodemailer from 'nodemailer';

/**
 * Send an email using nodemailer.
 * Expects SMTP configuration in environment variables.
 */
export const sendEmail = async (options) => {
    try {
        // Create a transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Verify connection configuration
        try {
            await transporter.verify();
            console.log('[EmailService] SMTP connection verified');
        } catch (verifyError) {
            console.error('[EmailService] SMTP connection failed:', verifyError.message);
            throw new Error(`SMTP Connection Error: ${verifyError.message}`);
        }

        // Define the email options
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html,
        };

        // Send the email
        console.log(`[EmailService] Sending reset email to ${options.email}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Email sent successfully: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EmailService] Email failed: ${error.message}`);
        throw error;
    }
};

export default sendEmail;
