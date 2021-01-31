// --------------------------------------------------------------
// Mock methods in config.js that use the Storage API,
// as "chrome.storage" is not available outside of webextension
// --------------------------------------------------------------

const mocks = {
  loadFromBrowserStorage: function(items, callback_function) {
    const result = {}

    if (typeof items === 'string')
      items = [items]

    if (Array.isArray(items)) {
      items.forEach(item => {
        result[item] = localStorage.getItem(item)
      })
    }

    if (typeof callback_function === 'function')
      callback_function(result)
  },

  storeInBrowserStorage: function(items, callback_function) {
    for (let item in items) {
      localStorage.setItem(item, items[item])
    }

    if (typeof callback_function === 'function')
      callback_function()
  }
}

// --------------------------------------------------------------
// add event listeners
// --------------------------------------------------------------

const invokeTestRunner = window.onload
window.onload = undefined

const iframe          = document.getElementById('config')
const config_window   = iframe.contentWindow
let   config_document = null

config_window.addEventListener('DOMContentLoaded', function() {
  config_window.onload = function() {
    for (let mock in mocks) {
      config_window[mock] = mocks[mock].bind(config_window)
    }

    const config = { headers: [], debug_mode: false, show_comments: true }
    config_window.storeInBrowserStorage({ started: 'off', config: JSON.stringify(config) })
    config_window.initConfigurationPage()

    config_document = config_window.document
    invokeTestRunner()
  }
})

// --------------------------------------------------------------
// describe tests
// --------------------------------------------------------------

describe("Config", function() {

  function cleanConfigTableForTest() {
    let tr_elements = config_document.querySelectorAll("#config_tab tr");
     for (let i=0;i<tr_elements.length;i++) {
      tr_elements[i].parentNode.removeChild(tr_elements[i]);
     }
  }

  function createDefaultConfigForTest() {
     let headers = [];
     headers.push({url_contains:"",action:"add",header_name:"test-header-name",header_value:"test-header-value",comment:"test",apply_on:"req",status:"on"});
     config = {headers, debug_mode: false, show_comments: true};
     // save configuration
     localStorage.setItem("config",JSON.stringify(config));
  }

  describe("#function initConfigurationPage", function() {

    beforeEach(function() {
      createDefaultConfigForTest();
    });

    it("init default value should be ok", function() {
      config_window.initConfigurationPage();

      expect(config_document.getElementById("debug_mode").checked).toEqual(false);
      expect(config_document.getElementById("show_comments").checked).toEqual(true);
      expect(config_document.getElementById("url_contains1").value).toEqual("");
      expect(config_document.getElementById("select_action1").value).toEqual("add");
      expect(config_document.getElementById("header_name1").value).toEqual("test-header-name");
      expect(config_document.getElementById("header_value1").value).toEqual("test-header-value");
      expect(config_document.getElementById("comment1").value).toEqual("test");
      expect(config_document.getElementById("apply_on1").value).toEqual("req");
      expect(config_document.getElementById("activate_button1").className).toEqual("btn btn-primary btn-sm");
    });

    afterEach(function() {
     cleanConfigTableForTest();
    });
  });

  describe("#function create_configuration_data", function() {

    beforeEach(function() {
      createDefaultConfigForTest();
    });

    it("configuration data should reflect the configuration on the screen", function() {
      config_window.initConfigurationPage();
      var config = JSON.parse(config_window.create_configuration_data());

      expect(config.show_comments).toEqual(true);
      expect(config.debug_mode).toEqual(false);
      expect(config.headers[0].url_contains).toEqual("");
      expect(config.headers[0].action).toEqual("add");
      expect(config.headers[0].header_name).toEqual("test-header-name");
      expect(config.headers[0].header_value).toEqual("test-header-value");
      expect(config.headers[0].comment).toEqual("test");
      expect(config.headers[0].apply_on).toEqual("req");
      expect(config.headers[0].status).toEqual("on");
    });

    it("text field url pattern should be black if pattern is valid", function() {
      const regex = ".*";
      config_window.initConfigurationPage();
      config_document.getElementById("url_contains1").value = regex;
      config_window.create_configuration_data();
      expect(config_document.getElementById('url_contains1').style.color).toEqual("black");
    });

    it("text field url pattern should be red if pattern is invalid", function() {
      const regex = "[z-a]";
      config_window.initConfigurationPage();
      config_document.getElementById("url_contains1").value = regex;
      try {
        config_window.create_configuration_data();
      }
      catch(error) {
        expect(error.message).toEqual("invalid regex pattern:\n'" + regex + "'");
        expect(config_document.getElementById('url_contains1').style.color).toEqual("red");
      }
    });

    afterEach(function() {
     cleanConfigTableForTest();
    });
  });

  describe("#function loadConfiguration", function() {

  // mock
   let mockAlertMessage="";
   config_window.reloadConfigPage= function() {};
   config_window.alert = function(message) {mockAlertMessage = message;}

    it("should load configuration", function() {
      const config= '{"debug_mode":true,"headers":[{"url_contains":"test","action":"add","header_name":"test-header-name","header_value":"test-header-value","comment":"test","apply_on":"res","status":"on"},{"url_contains":"test2","action":"add","header_name":"test-header-name2","header_value":"test-header-value2","comment":"test2","apply_on":"res","status":"on"}]}';
      config_window.loadConfiguration(config);
      const result = JSON.parse(localStorage.getItem("config"));

      expect(result.debug_mode).toEqual(true);
      expect(result.headers[0].url_contains).toEqual("test");
      expect(result.headers[0].action).toEqual("add");
      expect(result.headers[0].header_name).toEqual("test-header-name");
      expect(result.headers[0].header_value).toEqual("test-header-value");
      expect(result.headers[0].comment).toEqual("test");
      expect(result.headers[0].apply_on).toEqual("res");
      expect(result.headers[0].status).toEqual("on");
      expect(result.headers[1].header_name).toEqual("test-header-name2");
      expect(result.headers[1].header_value).toEqual("test-header-value2");
    });

    it("should popup an alert if json is invalid", function() {
      const config= '[{"action":';
      mockAlertMessage ="";
      config_window.loadConfiguration(config);
      expect(mockAlertMessage).toEqual("Invalid file format");
    });

    it("should popup an alert if data is not json", function() {
      const config= 'nothing useful';
      mockAlertMessage ="";
      config_window.loadConfiguration(config);
      expect(mockAlertMessage).toEqual("Invalid file format");
    });

  });

  describe("#function appendLine", function() {

    beforeEach(function() {
      createDefaultConfigForTest();
    });

    it("append one line should create a new line and not more", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("test","add","-","-","","req","on");

      expect(config_document.getElementById("url_contains2")).not.toEqual(null);
      expect(config_document.getElementById("url_contains3")).toEqual(null);
    });

    it("append two lines should create two lines and not more", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("test","add","-","-","","req","on");
      config_window.appendLine("test","add","-","-","","req","on");

      expect(config_document.getElementById("url_contains2")).not.toEqual(null);
      expect(config_document.getElementById("url_contains3")).not.toEqual(null);
      expect(config_document.getElementById("url_contains4")).toEqual(null);
    });

    it("append three lines should create three lines and not more", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("test","add","-","-","","req","on");
      config_window.appendLine("test","add","-","-","","req","on");
      config_window.appendLine("test","add","-","-","","req","on");

      expect(config_document.getElementById("url_contains2")).not.toEqual(null);
      expect(config_document.getElementById("url_contains3")).not.toEqual(null);
      expect(config_document.getElementById("url_contains4")).not.toEqual(null);
      expect(config_document.getElementById("url_contains5")).toEqual(null);
    });

    afterEach(function() {
     cleanConfigTableForTest();
    });
  });

  describe("#function deleteLine", function() {

    beforeEach(function() {
      createDefaultConfigForTest();
    });

    it("delete line 3 should delete line 3 form the GUI", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("line2","add","header_name2","header_value2","comment2","req","on");
      config_window.appendLine("line3","add","header_name3","header_value3","comment3","req","on");
      config_window.appendLine("line4","modify","test_name","test_value","test_comment","res","off");
      config_window.deleteLine(3);

      expect(config_document.getElementById("url_contains4")).toEqual(null);
      expect(config_document.getElementById("url_contains3").value).toEqual("line4");
      expect(config_document.getElementById("select_action3").value).toEqual("modify");
      expect(config_document.getElementById("header_name3").value).toEqual("test_name");
      expect(config_document.getElementById("header_value3").value).toEqual("test_value");
      expect(config_document.getElementById("comment3").value).toEqual("test_comment");
      expect(config_document.getElementById("apply_on3").value).toEqual("res");
      expect(config_document.getElementById("activate_button3").className).toEqual("btn btn-default btn-sm");
      expect(config_document.getElementById("url_contains2").value).toEqual("line2");
      expect(config_document.getElementById("header_name2").value).toEqual("header_name2");
      expect(config_document.getElementById("header_value2").value).toEqual("header_value2");
      expect(config_document.getElementById("comment2").value).toEqual("comment2");
    });

    it("delete line 1 should delete line 1 form the GUI", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("line2","add","-","-","","req","on");
      config_window.appendLine("line3","add","-","-","","req","on");
      config_window.appendLine("line4","add","-","-","","req","on");
      config_window.deleteLine(1);

      expect(config_document.getElementById("url_contains4")).toEqual(null);
      expect(config_document.getElementById("url_contains3").value).toEqual("line4");
      expect(config_document.getElementById("url_contains2").value).toEqual("line3");
      expect(config_document.getElementById("url_contains1").value).toEqual("line2");
    });

    afterEach(function() {
     cleanConfigTableForTest();
    });
  });

  describe("#function invertLine", function() {

    beforeEach(function() {
      createDefaultConfigForTest();
    });

    it("invert line 2 with line 3 should invert line on the GUI", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("line2","add","header_name2","header_value2","comment2","res","off");
      config_window.appendLine("line3","delete","header_name3","header_value3","comment3","req","on");
      config_window.appendLine("line4","modify","test_name","test_value","test_comment","res","off");
      config_window.invertLine(2,3);

      expect(config_document.getElementById("url_contains4").value).toEqual("line4");
      expect(config_document.getElementById("url_contains3").value).toEqual("line2");
      expect(config_document.getElementById("url_contains2").value).toEqual("line3");
      expect(config_document.getElementById("select_action3").value).toEqual("add");
      expect(config_document.getElementById("select_action2").value).toEqual("delete");
      expect(config_document.getElementById("header_name3").value).toEqual("header_name2");
      expect(config_document.getElementById("header_name2").value).toEqual("header_name3")
      expect(config_document.getElementById("header_value3").value).toEqual("header_value2");
      expect(config_document.getElementById("header_value2").value).toEqual("header_value3");
      expect(config_document.getElementById("comment3").value).toEqual("comment2");
      expect(config_document.getElementById("comment2").value).toEqual("comment3");
      expect(config_document.getElementById("apply_on3").value).toEqual("res");
      expect(config_document.getElementById("apply_on2").value).toEqual("req");
      expect(config_document.getElementById("activate_button3").className).toEqual("btn btn-default btn-sm"); // button off
      expect(config_document.getElementById("activate_button2").className).toEqual("btn btn-primary btn-sm"); // button on
    });

    it("invert line 0 with line 3 should do nothing", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("line2","add","header_name2","header_value2","comment2","res","off");
      config_window.appendLine("line3","delete","header_name3","header_value3","comment3","req","on");
      config_window.appendLine("line4","modify","test_name","test_value","test_comment","res","off");
      config_window.invertLine(0,3);

      expect(config_document.getElementById("url_contains1").value).toEqual("");
      expect(config_document.getElementById("select_action1").value).toEqual("add");
      expect(config_document.getElementById("header_name1").value).toEqual("test-header-name");
      expect(config_document.getElementById("header_value1").value).toEqual("test-header-value");
      expect(config_document.getElementById("comment1").value).toEqual("test");
      expect(config_document.getElementById("apply_on1").value).toEqual("req");
      expect(config_document.getElementById("activate_button1").className).toEqual("btn btn-primary btn-sm");
      expect(config_document.getElementById("url_contains4").value).toEqual("line4");
      expect(config_document.getElementById("url_contains3").value).toEqual("line3");
      expect(config_document.getElementById("url_contains2").value).toEqual("line2");
      expect(config_document.getElementById("select_action3").value).toEqual("delete");
      expect(config_document.getElementById("select_action2").value).toEqual("add");
      expect(config_document.getElementById("header_name3").value).toEqual("header_name3");
      expect(config_document.getElementById("header_name2").value).toEqual("header_name2")
      expect(config_document.getElementById("header_value3").value).toEqual("header_value3");
      expect(config_document.getElementById("header_value2").value).toEqual("header_value2");
      expect(config_document.getElementById("comment3").value).toEqual("comment3");
      expect(config_document.getElementById("comment2").value).toEqual("comment2");
      expect(config_document.getElementById("apply_on3").value).toEqual("req");
      expect(config_document.getElementById("apply_on2").value).toEqual("res");
      expect(config_document.getElementById("activate_button2").className).toEqual("btn btn-default btn-sm"); // button off
      expect(config_document.getElementById("activate_button3").className).toEqual("btn btn-primary btn-sm"); // button on
    });

   it("invert line 4 with line 5 should do nothing", function() {
      config_window.initConfigurationPage();
      config_window.appendLine("line2","add","header_name2","header_value2","comment2","res","off");
      config_window.appendLine("line3","delete","header_name3","header_value3","comment3","req","on");
      config_window.appendLine("line4","modify","test_name","test_value","test_comment","res","off");
      config_window.invertLine(4,5);

      expect(config_document.getElementById("url_contains1").value).toEqual("");
      expect(config_document.getElementById("select_action1").value).toEqual("add");
      expect(config_document.getElementById("header_name1").value).toEqual("test-header-name");
      expect(config_document.getElementById("header_value1").value).toEqual("test-header-value");
      expect(config_document.getElementById("comment1").value).toEqual("test");
      expect(config_document.getElementById("apply_on1").value).toEqual("req");
      expect(config_document.getElementById("activate_button1").className).toEqual("btn btn-primary btn-sm");// button on

      expect(config_document.getElementById("url_contains4").value).toEqual("line4");
      expect(config_document.getElementById("select_action4").value).toEqual("modify");
      expect(config_document.getElementById("header_name4").value).toEqual("test_name");
      expect(config_document.getElementById("header_value4").value).toEqual("test_value");
      expect(config_document.getElementById("comment4").value).toEqual("test_comment");
      expect(config_document.getElementById("apply_on4").value).toEqual("res");
      expect(config_document.getElementById("activate_button4").className).toEqual("btn btn-default btn-sm");// button off

      expect(config_document.getElementById("url_contains3").value).toEqual("line3");
      expect(config_document.getElementById("url_contains2").value).toEqual("line2");
      expect(config_document.getElementById("select_action3").value).toEqual("delete");
      expect(config_document.getElementById("select_action2").value).toEqual("add");
      expect(config_document.getElementById("header_name3").value).toEqual("header_name3");
      expect(config_document.getElementById("header_name2").value).toEqual("header_name2")
      expect(config_document.getElementById("header_value3").value).toEqual("header_value3");
      expect(config_document.getElementById("header_value2").value).toEqual("header_value2");
      expect(config_document.getElementById("comment3").value).toEqual("comment3");
      expect(config_document.getElementById("comment2").value).toEqual("comment2");
      expect(config_document.getElementById("apply_on3").value).toEqual("req");
      expect(config_document.getElementById("apply_on2").value).toEqual("res");
      expect(config_document.getElementById("activate_button2").className).toEqual("btn btn-default btn-sm"); // button off
      expect(config_document.getElementById("activate_button3").className).toEqual("btn btn-primary btn-sm"); // button on
    });

    afterEach(function() {
     cleanConfigTableForTest();
    });
  });

  describe("#function isRegExpValid", function() {

    it("should validate the '*' pattern", function() {
      expect(config_window.isRegExpValid(".*")).toEqual(true);
    });

    it("should validate the '*://*/*' pattern", function() {
      expect(config_window.isRegExpValid("[^:/]+://[^/]+/[^/]+")).toEqual(true);
    });

    it("should validate the 'http://*/*' pattern", function() {
      expect(config_window.isRegExpValid("https?://[^/]+/[^/]+")).toEqual(true);
    });

  });

});
