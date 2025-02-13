import versionsJson from "./versions.json";
import populateVersions from "./populate-versions";
import { JSONEditor } from "vanilla-jsoneditor";

function allowedVersion(version) {
  const allVersions = Object.keys(versionsJson);
  return allVersions.includes(version);
}

function isLegacy(version) {
  return Boolean(versionsJson[version].legacy);
}

function defaultVersion() {
  const defaultVersion = Object.entries(versionsJson).find(
    ([version, { default: isDefault }]) => {
      if (isDefault) return true;
    }
  );
  return defaultVersion?.[0];
}

function scriptSRC(version, legacy = false) {
  if (legacy) {
    return `https://cdn.jsdelivr.net/npm/rrweb-player@${version}/dist/index.js`;
  }
  // return `https://cdn.jsdelivr.net/npm/rrweb-player@${version}/dist/rrweb-player.umd.cjs`; // <= https://github.com/jsdelivr/jsdelivr/issues/18584
  return `https://unpkg.dev/rrweb-player@${version}/dist/rrweb-player.umd.cjs`;
}
function styleHref(version) {
  return `https://cdn.jsdelivr.net/npm/rrweb-player@${version}/dist/style.css`;
}
function setupVersionSelector(version) {
  populateVersions(version);
  document.getElementById("versions").addEventListener("change", (e) => {
    const newVersion = e.target.value;
    // reload page with selected version
    const location = new URL(document.location);
    location.searchParams.set("version", newVersion);

    document.location.href = location.href;
  });
}

async function playVideo(events, config) {
  const Player = window.rrwebPlayer.Player || window.rrwebPlayer; // for legacy version
  const component = new Player({
    target: document.getElementById("player"),
    data: {
      events,
      skipInactive: true,
      showDebug: true,
      showWarning: true,
      autoPlay: config.autoPlay,
      useVirtualDom: config.useVirtualDom,
      UNSAFE_replayCanvas: config.canvas,
      mouseTail: {
        strokeStyle: "yellow",
      },
    },
  });
  window.$c = component;
  window.events = events;
  document.querySelector(".loading").style.display = "none";
  component.addEventListener("finish", () => console.log("finish"));
}

function showJSON(json) {
  const container = document.getElementById("jsoneditor");

  const editor = new JSONEditor({
    target: container,
    props: { content: { json }, mode: "view" },
  });
  window.events = events;
}

function getGistId(url) {
  const match = /gist.github(?:usercontent)?.com\/[^/]+\/(\w+)/.exec(url);
  return match?.[1] || false;
}

function getJSONBlobId(url) {
  const match = /https?:\/\/jsonblob.com\/([\w\-]+)/.exec(url);
  return match?.[1] || false;
}

async function startPlayer() {
  const location = new URL(document.location);
  const url = location.searchParams.get("url");
  let version = location.searchParams.get("version");
  if (!allowedVersion(version)) version = defaultVersion();
  const legacy = isLegacy(version);
  const canvas = Boolean(location.searchParams.get("canvas"));
  const autoPlay = Boolean(location.searchParams.get("play"));
  const useVirtualDom = Boolean(location.searchParams.get("virtual-dom"));
  let events;
  const gistId = getGistId(url);
  const jsonBlobId = getJSONBlobId(url);
  if (gistId) {
    try {
      const gistApiRequest = await fetch(
        `https://api.github.com/gists/${gistId}`
      );
      const apiResponse = await gistApiRequest.json();
      const files = Object.values(apiResponse.files);
      if (files[0].truncated) {
        const eventsRequest = await fetch(files[0].raw_url);
        events = await eventsRequest.json();
      } else {
        // if js
        // Function('"use strict";return (' + js.replace(/^\s*(const|let|var)\s\w+\s*=\s*/, '').replace(/;[\s\n]*$/, '') + ')')()
        events = JSON.parse(files[0].content);
      }
    } catch (error) {
      alert("something went wrong, please check the console");
      console.error(error);
    }
  } else if (jsonBlobId) {
    try {
      const jsonBlobApiRequest = await fetch(
        `https://jsonblob.com/api/v1/get/${jsonBlobId}`
      );
      events = await jsonBlobApiRequest.json();
    } catch (error) {
      alert("something went wrong, please check the console");
      console.error(error);
    }
  } else {
    try {
      const eventsRequest = await fetch(url);
      events = await eventsRequest.json();
    } catch (error) {
      alert("something went wrong, please check the console");
      console.error(error);
    }
  }

  const styleEl = document.createElement("link");
  styleEl.setAttribute("rel", "stylesheet");
  styleEl.setAttribute("href", styleHref(version));
  document.head.appendChild(styleEl);

  const scriptEl = document.createElement("script");
  scriptEl.setAttribute("src", scriptSRC(version, legacy));
  scriptEl.setAttribute("type", "application/javascript");
  scriptEl.addEventListener("load", function () {
    playVideo(events, {
      canvas,
      autoPlay,
      useVirtualDom,
    });
    showJSON(events);
  });

  setupVersionSelector(version);

  document.head.appendChild(scriptEl);
  document.querySelector("a.json").setAttribute("href", url);
  document.querySelector("a.json").innerText = url;
}

document.onload = startPlayer();
