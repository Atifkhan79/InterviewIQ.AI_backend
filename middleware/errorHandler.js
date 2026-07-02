class ErrorHandler extends Error {
    constructor(message, statuscode) {
        super(message);
        this.statuscode = statuscode;
    }
}

export const errorMiddleware = (err, req, res, next) => {
    let statuscode = err.statuscode || 500;
    let message = err.message || 'Internal Server Error.';

    if (err.name === "CastError") {
        message = `Invalid ${err.path}`;
        statuscode = 400;
    }

    if (err.name === "JsonWebTokenError") {
        message = `Json Web Token is Invalid, Try again`;
        statuscode = 400;
    }

    if (err.name === "TokenExpiredError") {
        message = `Json Web Token is expired, Try again`;
        statuscode = 400;
    }

    if (err.code === 11000) {
        message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
        statuscode = 400;
    }

    if (err.name === "ValidationError") {
        message = Object.values(err.errors).map(val => val.message).join(", ");
        statuscode = 400;
    }

    return res.status(statuscode).json({
        success: false,
        message
    });
}

export default ErrorHandler;