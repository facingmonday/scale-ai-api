const fs = require("fs");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SCALE LXP API",
      version: "1.0.0",
      description:
        "API documentation for the SCALE LXP supply chain simulation platform.",
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Enter your Clerk JWT session token to access the protected endpoints.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message explaining what went wrong.",
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, "../apps/api/index.js"),
    path.join(__dirname, "../services/**/*.js"),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
const destPath = path.join(__dirname, "../apps/docs/public/swagger.json");

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, JSON.stringify(swaggerSpec, null, 2));
console.log(
  "OpenAPI spec successfully written to apps/docs/public/swagger.json",
);
