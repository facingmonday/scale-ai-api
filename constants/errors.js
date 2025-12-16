const ErrorCodes = Object.freeze({
  NOT_FOUND: "NOT_FOUND",
  MAX_CAPACITY_REACHED: "MAX_CAPACITY_REACHED",
  EVENT_IN_PAST: "EVENT_IN_PAST",
  MEMBER_EXISTS: "MEMBER_EXISTS",
  MEMBER_NOT_ELIGIBLE: "MEMBER_NOT_ELIGIBLE",
  ORGANIZATION_MISMATCH: "ORGANIZATION_MISMATCH",
  Order_ALREADY_EXISTS: "Order_ALREADY_EXISTS",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  SUBSCRIPTION_PAYMENT_FAILED: "SUBSCRIPTION_PAYMENT_FAILED",
  SUBSCRIPTION_TIER_NOT_ELIGIBLE: "SUBSCRIPTION_TIER_NOT_ELIGIBLE",
  BAD_REQUEST: "BAD_REQUEST",
  CART_NOT_FOUND: "CART_NOT_FOUND",
  EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
  TICKET_TYPE_NOT_FOUND: "TICKET_TYPE_NOT_FOUND",
  NOT_ENOUGH_TICKETS_AVAILABLE: "NOT_ENOUGH_TICKETS_AVAILABLE",
  INVALID_ACCESS_CODE: "INVALID_ACCESS_CODE",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  ORGANIZATION_NOT_FOUND: "ORGANIZATION_NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
});

const ErrorMessages = Object.freeze({
  [ErrorCodes.NOT_FOUND]: "Resource not found",
  [ErrorCodes.MAX_CAPACITY_REACHED]: "Event has reached maximum capacity",
  [ErrorCodes.EVENT_IN_PAST]: "Event date is in the past",
  [ErrorCodes.MEMBER_EXISTS]: "Member already exists",
  [ErrorCodes.MEMBER_NOT_ELIGIBLE]: "Member is not eligible for this event",
  [ErrorCodes.ORGANIZATION_MISMATCH]: "Organization mismatch",
  [ErrorCodes.Order_ALREADY_EXISTS]: "You have already Ordered for this event",
  [ErrorCodes.SUBSCRIPTION_REQUIRED]:
    "A valid subscription is required for this feature",
  [ErrorCodes.SUBSCRIPTION_EXPIRED]: "Your subscription has expired",
  [ErrorCodes.SUBSCRIPTION_PAYMENT_FAILED]:
    "Your subscription payment has failed",
  [ErrorCodes.SUBSCRIPTION_TIER_NOT_ELIGIBLE]:
    "Your subscription tier does not include this feature",
  [ErrorCodes.BAD_REQUEST]: "Bad request",
  [ErrorCodes.CART_NOT_FOUND]:
    "Your cart could not be found. Please try adding tickets again.",
  [ErrorCodes.EVENT_NOT_FOUND]:
    "The event could not be found. Please check the event link and try again.",
  [ErrorCodes.TICKET_TYPE_NOT_FOUND]:
    "The selected ticket type is no longer available.",
  [ErrorCodes.NOT_ENOUGH_TICKETS_AVAILABLE]:
    "Sorry, some tickets are no longer available. Please try again in a few minutes.",
  [ErrorCodes.INVALID_ACCESS_CODE]:
    "The access code you entered is invalid. Please check and try again.",
  [ErrorCodes.INTERNAL_SERVER_ERROR]: "Something went wrong. Please try again.",
  [ErrorCodes.ORGANIZATION_NOT_FOUND]:
    "The organization could not be found. Please check the event link and try again.",
  [ErrorCodes.VALIDATION_ERROR]: "Please check your information and try again.",
  [ErrorCodes.UNAUTHORIZED]: "You are not authorized to perform this action.",
  [ErrorCodes.FORBIDDEN]: "Access denied. Please check your permissions.",
  [ErrorCodes.CONFLICT]:
    "There was a conflict with your request. Please try again.",
  [ErrorCodes.TOO_MANY_REQUESTS]:
    "Too many requests. Please wait a moment and try again.",
  [ErrorCodes.SERVICE_UNAVAILABLE]:
    "Service temporarily unavailable. Please try again later.",
});

module.exports = {
  ErrorCodes,
  ErrorMessages,
};
