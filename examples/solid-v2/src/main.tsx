/* @refresh reload */
import { render } from "@solidjs/web";
import App from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found");

render(() => <App />, root);
