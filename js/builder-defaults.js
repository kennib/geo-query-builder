var builderDefaults = angular.module('builder-defaults', []);

/* Default values for service settings */
builderDefaults.value("defaults", {
  WMS: {
    requestType: "GetMap", 
    format: "image/png",
  },
  WFS: {
    requestType: "GetFeature",
    format: "json",
  },
});
