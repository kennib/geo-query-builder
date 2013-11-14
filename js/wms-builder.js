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

wmsBuilder.value("hosts", {
  "NICTA - GeoTopo250K": "http://geospace.research.nicta.com.au:8080/geotopo_250k/geotopo_250k/ows",
  "NICTA - Admin Bounds": "http://geospace.research.nicta.com.au:8080/admin_bnds/admin_bnds/ows",
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
  "PNG": "PNG",
  "GeoJSON": "json",
})

wmsBuilder.controller("builder", ["$scope",
  "hosts", "serviceTypes", "requestTypes", "formats",
  function($scope, hosts, serviceTypes, requestTypes, formats) {
    $scope.hosts = hosts;
    $scope.host = hosts["NICTA - Admin Bounds"];

    $scope.serviceTypes = serviceTypes;
    $scope.serviceType = serviceTypes["WMS"];

    $scope.requestTypes = requestTypes;
    $scope.requestType = requestTypes["Get Map"];
    $scope.validRequestType = function(requestType) {
      return $scope.serviceType.requestTypes[requestType] !== undefined;
    }

    $scope.typeName = "";
    $scope.featureLimit = 50;

    $scope.formats = formats;
    $scope.format = formats["PNG"];

    $scope.url = function() {
      return $scope.host + '?' +
        'service=' + $scope.serviceType.url +
        '&request=' + $scope.requestType +
        '&typeName=' + $scope.typeName +
        '&maxFeatures=' + $scope.featureLimit +
        '&outputFormat=' + $scope.format;
    }
  }]);
