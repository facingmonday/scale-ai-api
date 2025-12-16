const handlebars = require("handlebars");

// Register Handlebars helpers
function registerHelpers() {
  handlebars.registerHelper("formatDate", function (date) {
    if (!date) return "";
    // Create a date object from the UTC string
    const utcDate = new Date(date);
    // Format the date in the local timezone
    return utcDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC", // Ensure we use UTC
    });
  });

  handlebars.registerHelper("formatTime", function (time) {
    if (!time) return "";

    // Parse the 24-hour time string (e.g., "14:30")
    const [hours, minutes] = time.split(":").map((num) => parseInt(num, 10));

    // Convert to 12-hour format
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight

    // Format minutes with leading zero
    const formattedMinutes = minutes.toString().padStart(2, "0");

    return `${hours12}:${formattedMinutes} ${period}`;
  });

  handlebars.registerHelper("formatDateTime", function (date) {
    if (!date) return "";
    const utcDate = new Date(date);
    return utcDate.toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  });

  handlebars.registerHelper("truncate", function (str, length) {
    if (!str) return "";
    return str.length > length ? str.substring(0, length) + "..." : str;
  });

  handlebars.registerHelper("capitalize", function (str) {
    if (!str || typeof str !== "string") {
      return "";
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  handlebars.registerHelper("uppercase", function (str) {
    if (!str) return "";
    return str.toUpperCase();
  });

  handlebars.registerHelper("lowercase", function (str) {
    if (!str) return "";
    return str.toLowerCase();
  });

  handlebars.registerHelper("qrCode", function (text) {
    if (!text) return "";
    const html = `<img src="${process.env.SCALE_API_HOST}/qrcodes/create-qr-code/?data=${text}&size=150x150" alt="QR Code" />`;
    return new handlebars.SafeString(html);
  });

  handlebars.registerHelper("divide", function (a, b) {
    return a / b;
  });

  handlebars.registerHelper("not", function (a) {
    return !a;
  });

  handlebars.registerHelper("and", function (a, b) {
    return a && b;
  });

  handlebars.registerHelper("mod", function (a, b) {
    return a % b;
  });

  handlebars.registerHelper("sum", function (array) {
    if (!Array.isArray(array)) return 0;
    return array.reduce((sum, num) => sum + (Number(num) || 0), 0);
  });

  handlebars.registerHelper("reduce", function (array, initialValue, property) {
    if (!Array.isArray(array)) return initialValue || 0;
    return array.reduce((total, item) => {
      if (property && typeof item === "object") {
        return total + (Number(item[property]) || 0);
      }
      return total + (Number(item) || 0);
    }, initialValue || 0);
  });

  handlebars.registerHelper("map", function (array, property) {
    if (!Array.isArray(array)) return [];
    return array.map((item) => {
      if (typeof property === "string") {
        return item[property];
      }
      return item;
    });
  });

  handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  handlebars.registerHelper("add", function (a, b) {
    return a + b;
  });
}

// Register the helpers when this module is imported
registerHelpers();

// Export handlebars with the registered helpers
module.exports = handlebars;
