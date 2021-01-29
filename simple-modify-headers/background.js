/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 *
 * @author didierfred@gmail.com
 * @version 0.4
 */

"use strict";

let config
let started = 'off'
let debug_mode = false

/*
* Initialize global state
*
*/
loadFromBrowserStorage(['config', 'started'], function (result) {
  if (result.config === undefined) {
    loadDefaultConfiguration()
  }
  else {
    started = result.started
    config = JSON.parse(result.config)
    preProcessConfig()
  }

  if (started === 'on') {
    addListeners()
    chrome.browserAction.setIcon({ path: 'icons/modify-green-32.png' })
  }
  else if (started !== 'off') {
    started = 'off'
    storeInBrowserStorage({ started: 'off' })
  }

  // listen for change in configuration or start/stop
  chrome.runtime.onMessage.addListener(notify)
})

function loadDefaultConfiguration() {
  console.log("Load default config")

  const headers = []
  headers.push({ url_contains: "^https?://httpbin\\.org/.*$",      action: "add", header_name: "test-header-name-1", header_value: "test-header-value-1", comment: "test at: https://httpbin.org/headers", apply_on: "req", status: "on" })
  headers.push({ url_contains: "",                                 action: "add", header_name: "test-header-name-2", header_value: "test-header-value-2", comment: "",                                     apply_on: "req", status: "on" })
  headers.push({ url_contains: "^https?://postman-echo\\.com/.*$", action: "add", header_name: "test-header-name-3", header_value: "test-header-value-3", comment: "test at: http://postman-echo.com/get", apply_on: "req", status: "on" })
  headers.push({ url_contains: "",                                 action: "add", header_name: "test-header-name-4", header_value: "test-header-value-4", comment: "",                                     apply_on: "req", status: "on" })

  config = { headers: headers, debug_mode: false, show_comments: true }
  storeInBrowserStorage({ started, config: JSON.stringify(config) })
  preProcessConfig()
}

function preProcessConfig() {
  if (!config || !config.headers || !config.headers.length)
    return

  let header
  for (let i=0; i < config.headers.length; i++) {
    header = config.headers[i]

    if (header.url_contains && (typeof header.url_contains === 'string'))
      header.url_contains = new RegExp(header.url_contains, 'i')
  }
}

function loadFromBrowserStorage(item, callback_function) {
  chrome.storage.local.get(item, callback_function)
}

function storeInBrowserStorage(item, callback_function) {
  chrome.storage.local.set(item, callback_function)
}

/*
* Standard function to log messages
*
*/
function log(message) {
  console.log(new Date() + " SimpleModifyHeader : " + message)
}

/*
* Rewrite HTTP headers (add, modify, or delete)
*
*/
function rewriteHttpHeaders(headers, url, apply_on) {
  const headersType = (apply_on === "req") ? "request" : "response"

  if (config.debug_mode) log("Start modify " + headersType + " headers for url " + url)
  let prev_url_contains = null
  for (let to_modify of config.headers) {
    if (to_modify.url_contains) prev_url_contains = to_modify.url_contains
    if ((to_modify.status === "on") && (to_modify.apply_on === apply_on) && prev_url_contains && prev_url_contains.test(url)) {
      if (to_modify.action === "add") {
        if (config.debug_mode) log("Add " + headersType + " header : name=" + to_modify.header_name + ",value=" + to_modify.header_value + " for url " + url)
        const new_header = { "name": to_modify.header_name, "value": to_modify.header_value }
        headers.push(new_header)
      }
      else if (to_modify.action === "modify") {
        for (let header of headers) {
          if (header.name.toLowerCase() === to_modify.header_name.toLowerCase()) {
            if (config.debug_mode) log("Modify " + headersType + " header :  name= " + to_modify.header_name + ",old value=" + header.value + ",new value=" + to_modify.header_value + " for url " + url)
            header.value = to_modify.header_value
          }
        }
      }
      else if (to_modify.action === "delete") {
        for (let i = (headers.length - 1); i >= 0; i--) {
          if (headers[i].name.toLowerCase() === to_modify.header_name.toLowerCase()) {
            if (config.debug_mode) log("Delete " + headersType + " header :  name=" + to_modify.header_name.toLowerCase() + " for url " + url)
            headers.splice(i, 1)
          }
        }
      }
    }
  }
  if (config.debug_mode) log("End modify " + headersType + " headers for url " + url)
}

/*
* Rewrite HTTP request headers (add, modify, or delete)
*
*/
function rewriteRequestHeaders(details) {
  const headers  = details.requestHeaders
  const url      = details.url
  const apply_on = "req"

  rewriteHttpHeaders(headers, url, apply_on)

  return { requestHeaders: headers }
}

/*
* Rewrite HTTP response headers (add, modify, or delete)
*
*/
function rewriteResponseHeaders(details) {
  const headers  = details.responseHeaders
  const url      = details.url
  const apply_on = "res"

  rewriteHttpHeaders(headers, url, apply_on)

  return { responseHeaders: headers }
}

/*
* Listen for message form config.js
* if message is reload : reload the configuration
* if message is on : start the modify header
* if message is off : stop the modify header
*
**/
function notify(message) {
  if (message === "reload") {
    if (config.debug_mode) log("Reload configuration")
    loadFromBrowserStorage(['config'], function (result) {
      config = JSON.parse(result.config)
      preProcessConfig()
    })
  }
  else if (message === "off") {
    removeListeners()
    chrome.browserAction.setIcon({ path: "icons/modify-32.png" })
    started = "off"
    if (config.debug_mode) log("Stop modifying headers")
  }
  else if (message === "on") {
    addListeners()
    chrome.browserAction.setIcon({ path: "icons/modify-green-32.png" })
    started = "on"
    if (config.debug_mode) log("Start modifying headers")
  }
}

/*
* Add rewriteRequestHeaders  as a listener to onBeforeSendHeaders.
* Add rewriteResponseHeaders as a listener to onHeadersReceived.
* Make it "blocking" so we can modify the headers.
*
*/
function addListeners() {
  let extraInfoSpec

  // "extraHeaders" option is needed for Chrome v72+: https://developer.chrome.com/extensions/webRequest
  extraInfoSpec = chrome.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty('EXTRA_HEADERS')
    ? ["blocking", "requestHeaders", "extraHeaders"]
    : ["blocking", "requestHeaders"]

  chrome.webRequest.onBeforeSendHeaders.addListener(
    rewriteRequestHeaders,
    { urls: ["<all_urls>"] },
    extraInfoSpec
  )

  // "extraHeaders" option is needed for Chrome v72+: https://developer.chrome.com/extensions/webRequest
  extraInfoSpec = chrome.webRequest.OnHeadersReceivedOptions.hasOwnProperty('EXTRA_HEADERS')
    ? ["blocking", "responseHeaders", "extraHeaders"]
    : ["blocking", "responseHeaders"]

  chrome.webRequest.onHeadersReceived.addListener(
    rewriteResponseHeaders,
    { urls: ["<all_urls>"] },
    extraInfoSpec
  )
}

/*
* Remove the two listeners
*
*/
function removeListeners() {
  chrome.webRequest.onBeforeSendHeaders.removeListener(rewriteRequestHeaders)
  chrome.webRequest.onHeadersReceived.removeListener(rewriteResponseHeaders)
}
