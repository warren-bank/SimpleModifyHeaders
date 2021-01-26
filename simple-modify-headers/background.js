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
const isChrome = (navigator.userAgent.toLowerCase().indexOf("chrome") !== -1)

loadFromBrowserStorage(['config', 'started'], function (result) {
  // if old storage method
  if (result.config === undefined) loadConfigurationFromLocalStorage()
  else {
    started = result.started
    config = JSON.parse(result.config)
    preProcessConfig()
  }

  if (started === 'on') {
    addListener()
    chrome.browserAction.setIcon({ path: 'icons/modify-green-32.png' })
  }
  else if (started !== 'off') {
    started = 'off'
    storeInBrowserStorage({ started: 'off' })
  }
  // listen for change in configuration or start/stop
  chrome.runtime.onMessage.addListener(notify)
})

function loadConfigurationFromLocalStorage() {
  console.log("Load default config")

  const headers = []
  headers.push({ url_contains: "^https?://httpbin\\.org/.*$",      action: "add", header_name: "test-header-name-1", header_value: "test-header-value-1", comment: "test at: https://httpbin.org/headers", apply_on: "req", status: "on" })
  headers.push({ url_contains: "",                                 action: "add", header_name: "test-header-name-2", header_value: "test-header-value-2", comment: "",                                     apply_on: "req", status: "on" })
  headers.push({ url_contains: "^https?://postman-echo\\.com/.*$", action: "add", header_name: "test-header-name-3", header_value: "test-header-value-3", comment: "test at: http://postman-echo.com/get", apply_on: "req", status: "on" })
  headers.push({ url_contains: "",                                 action: "add", header_name: "test-header-name-4", header_value: "test-header-value-4", comment: "",                                     apply_on: "req", status: "on" })

  config = { headers: headers, debug_mode: false, show_comments: true }
  storeInBrowserStorage({ started: false, config: JSON.stringify(config) })
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
* Rewrite the request header (add , modify or delete)
*
*/
function rewriteRequestHeader(e) {
  if (config.debug_mode) log("Start modify request headers for url " + e.url)
  let prev_url_contains = null
  for (let to_modify of config.headers) {
    if (to_modify.url_contains) prev_url_contains = to_modify.url_contains;
    if ((to_modify.status === "on") && (to_modify.apply_on === "req") && prev_url_contains && prev_url_contains.test(e.url)) {
      if (to_modify.action === "add") {
        let new_header = { "name": to_modify.header_name, "value": to_modify.header_value }
        e.requestHeaders.push(new_header)
        if (config.debug_mode) log("Add request header : name=" + to_modify.header_name + ",value=" + to_modify.header_value + " for url " + e.url)
      }
      else if (to_modify.action === "modify") {
        for (let header of e.requestHeaders) {
          if (header.name.toLowerCase() === to_modify.header_name.toLowerCase()) {
            if (config.debug_mode) log("Modify request header :  name= " + to_modify.header_name + ",old value=" + header.value + ",new value=" + to_modify.header_value + " for url " + e.url)
            header.value = to_modify.header_value
          }
        }
      }
      else if (to_modify.action === "delete") {
        let index = -1
        for (let i = 0; i < e.requestHeaders.length; i++) {
          if (e.requestHeaders[i].name.toLowerCase() === to_modify.header_name.toLowerCase()) index = i
        }
        if (index !== -1) {
          e.requestHeaders.splice(index, 1)
          if (config.debug_mode) log("Delete request header :  name=" + to_modify.header_name.toLowerCase() + " for url " + e.url)
        }
      }
    }
  }
  if (config.debug_mode) log("End modify request headers for url " + e.url)
  return { requestHeaders: e.requestHeaders }
}

/*
* Rewrite the response header (add , modify or delete)
*
*/
function rewriteResponseHeader(e) {
  if (config.debug_mode) log("Start modify response headers for url " + e.url)
  let prev_url_contains = null
  for (let to_modify of config.headers) {
    if (to_modify.url_contains) prev_url_contains = to_modify.url_contains;
    if ((to_modify.status === "on") && (to_modify.apply_on === "res") && prev_url_contains && prev_url_contains.test(e.url)) {
      if (to_modify.action === "add") {
        let new_header = { "name": to_modify.header_name, "value": to_modify.header_value }
        e.responseHeaders.push(new_header)
        if (config.debug_mode) log("Add response header : name=" + to_modify.header_name + ",value=" + to_modify.header_value + " for url " + e.url)
      }
      else if (to_modify.action === "modify") {
        for (let header of e.responseHeaders) {
          if (header.name.toLowerCase() === to_modify.header_name.toLowerCase()) {
            if (config.debug_mode) log("Modify response header :  name= " + to_modify.header_name + ",old value=" + header.value + ",new value=" + to_modify.header_value + " for url " + e.url)
            header.value = to_modify.header_value
          }
        }
      }
      else if (to_modify.action === "delete") {
        let index = -1
        for (let i = 0; i < e.responseHeaders.length; i++) {
          if (e.responseHeaders[i].name.toLowerCase() === to_modify.header_name.toLowerCase()) index = i
        }
        if (index !== -1) {
          e.responseHeaders.splice(index, 1)
          if (config.debug_mode) log("Delete response header :  name=" + to_modify.header_name.toLowerCase() + " for url " + e.url)
        }
      }
    }
  }
  if (config.debug_mode) log("End modify response headers for url " + e.url)
  return { responseHeaders: e.responseHeaders }
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
    removeListener()
    chrome.browserAction.setIcon({ path: "icons/modify-32.png" })
    started = "off"
    if (config.debug_mode) log("Stop modifying headers")
  }
  else if (message === "on") {
    addListener()
    chrome.browserAction.setIcon({ path: "icons/modify-green-32.png" })
    started = "on"
    if (config.debug_mode) log("Start modifying headers")
  }
}

/*
* Add rewriteRequestHeader as a listener to onBeforeSendHeaders.
* Add rewriteResponseHeader as a listener to onHeadersReceived.
* Make it "blocking" so we can modify the headers.
*/
function addListener() {
  // need to had "extraHeaders" option for chrome https://developer.chrome.com/extensions/webRequest#life_cycle_footnote
  if (isChrome) {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      rewriteRequestHeader,
      { urls: ["<all_urls>"] },
      ["blocking", "requestHeaders", "extraHeaders"]
    )

    chrome.webRequest.onHeadersReceived.addListener(
      rewriteResponseHeader,
      { urls: ["<all_urls>"] },
      ["blocking", "responseHeaders", "extraHeaders"]
    )
  }

  else {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      rewriteRequestHeader,
      { urls: ["<all_urls>"] },
      ["blocking", "requestHeaders"]
    )

    chrome.webRequest.onHeadersReceived.addListener(
      rewriteResponseHeader,
      { urls: ["<all_urls>"] },
      ["blocking", "responseHeaders"]
    )
  }
}

/*
* Remove the two listener
*
*/
function removeListener() {
  chrome.webRequest.onBeforeSendHeaders.removeListener(rewriteRequestHeader)
  chrome.webRequest.onHeadersReceived.removeListener(rewriteResponseHeader)
}
