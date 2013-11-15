var wmsBuilder = angular.module("wms-builder", [
  "ngRoute",
]);

/* Filter an array by the objects in another array */
wmsBuilder.filter("isIn", function() {
  function isIn(obj, array) {
    return array.indexOf(obj) != -1;
  };

  return function(obj, filterArray) {
    var newObj = {};
    
    for (var key in obj) {
      if (isIn(key, filterArray) || isIn(obj[key], filterArray))
        newObj[key] = obj[key];
    }

    return newObj;

    /*
    var newArray = [];

    array.forEach(function(obj) {
      if (isIn(obj, filterArray))
        newArray.push(obj);
    });

    return newArray;
    */
  };
});

/* Get the capabilities of a WMS/WFS service */
wmsBuilder.service("getCapabilities", ['$http', function($http) {
  return function(request) {
    request.params.request = "GetCapabilities";
    request.headers["Accept"] = "application/xml";
    return $http(request);
  };
}]);

wmsBuilder.value("hosts", {
  "NICTA - GeoTopo250K": "http://geospace.research.nicta.com.au:8080/geotopo_250k",
  "NICTA - Admin Bounds": "http://geospace.research.nicta.com.au:8080/admin_bnds",
});

wmsBuilder.value("serviceTypes", {
  "WMS": {
    url: "WMS",
    requestTypes: [
      "GetMap",
    ],
    outputFormats: [
      "PNG",
    ],
  },
  "WFS": {
    url: "WFS",
    requestTypes: [
      "GetFeature",
    ],
    outputFormats: [
      "json",
    ],
  }
});

wmsBuilder.value("requestTypes", {
  "Get Feature": "GetFeature",
  "Get Map": "GetMap",
});

wmsBuilder.value("formats", {
  "PNG": "image/PNG",
  "GeoJSON": "json",
})

wmsBuilder.controller("builder", ["$scope", "$http",
  "getCapabilities",
  "hosts", "serviceTypes", "requestTypes", "formats",
  function($scope, $http, getCapabilities, hosts, serviceTypes, requestTypes, formats) {
    $scope.hosts = hosts;
    $scope.host = hosts["NICTA - Admin Bounds"];

    $scope.serviceTypes = serviceTypes;
    $scope.serviceType = serviceTypes["WMS"];

    $scope.requestTypes = requestTypes;
    $scope.requestType = requestTypes["Get Map"];
    $scope.validRequestType = function(requestType) {
      return $scope.serviceType.requestTypes[requestType] !== undefined;
    }
    
    $scope.formats = formats;
    $scope.format = formats["PNG"];

    $scope.bbox = {};

    $scope.typeName = "";
    $scope.featureLimit = 50;

    // Produce an angular request object
    function request() {
      window.bbox = $scope.bbox;
      var params = {
        service: $scope.serviceType.url,
        request: $scope.requestType,
        outputFormat: $scope.format,
        format: $scope.format,
        bbox: !$.isEmptyObject($scope.bbox) ? [$scope.bbox.minx, $scope.bbox.miny, $scope.bbox.maxx, $scope.bbox.maxy].join() : undefined,
      };

      if (params.service == "WMS") {
        params.layers = $scope.layer ? $scope.layer.Title : undefined;
      }
      if (params.service == "WFS") {
        params.typeName = $scope.typeName;
        params.maxFeatures = $scope.featureLimit;
      }

      var request = {
        method: "GET",
        headers: {},
        url: $scope.host + "/ows",
        params: params,
      };

      return request;
    }

    // Create a URL for the request
    $scope.url = function() {
      var req = request();
      return req.url + "?" + $.param(req.params);
    }

    // Get the capabilities of the current WMS/WFS server selection
    function updateCapabilities() {
      var req = request();

      getCapabilities(req).success(function(xml) {
        var cap = $.xml2json(xml).Capability;
        var layers = cap.Layer.Layer;

        $scope.layers = layers;
      });
    };

    // Update capabilities if the host or service type changes
    $scope.$watch('host', updateCapabilities);
    $scope.$watch('serviceType', updateCapabilities);

    // Update the bounding box based on the layer selection
    $scope.$watch('layer', function(layer) {
      if (layer) {
        var bbox = layer.BoundingBox[0];
        $scope.bbox = bbox;
      }
    });
  }]);
