import { html, render } from "lit-html";

import './ItemNavigator/ItemNavigator.js'

const sampleJson = require('./sample.json');
const encJson = btoa(JSON.stringify(sampleJson))

// // Define a template
const bookReaderTemplate = () =>
  html `
    <item-navigator     
      item=${encJson}
      itemType="bookreader" 
      basehost="archive.org" >
      <div id="IABookReaderWrapper" class="internal-beta" slot="bookreader">
        <div id="BookReader" class="BookReader"></div>
      </div>    
    </item-navigator>
  `

// const bookReaderTemplate = () => html` <p style="color: white;">Hello </p> `;

// Render the template to the document
render(bookReaderTemplate(), document.querySelector("#bookreader-container"));
