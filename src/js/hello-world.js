import { html, render } from "lit-html";

// Define a template
const myTemplate = (name) => html` <p style="color: white;">Hello ${name}</p> `;

// Render the template to the document
render(myTemplate("World"), document.querySelector("#hello"));
