const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (error) {
        // Extract field validation errors using Zod's built-in method
        const formattedErrors = {};
        if (error.flatten) {
            const fieldErrors = error.flatten().fieldErrors;
            for (const key in fieldErrors) {
                formattedErrors[key] = fieldErrors[key][0];
            }
        }

        let message = 'Validation failed';
        if (Object.keys(formattedErrors).length > 0) {
            // Use the first error message as the main message for better UX
            message = Object.values(formattedErrors)[0];
        }

        return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            message: message,
            errors: formattedErrors,
        });
    }
};

export default validate;
