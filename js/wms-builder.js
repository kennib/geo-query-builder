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

wmsBuilder.value("serviceTypes", [
  "WMS",
  "WFS",
])
 
wmsBuilder.controller("builder", ["$scope", "$http",
  "getCapabilities",
  "hosts", "serviceTypes",
  function($scope, $http, getCapabilities, hosts, serviceTypes) {
    $scope.hosts = hosts;
    $scope.host = hosts["NICTA - Admin Bounds"];

    $scope.serviceTypes = serviceTypes;
    $scope.serviceType = serviceTypes["WMS"];

    $scope.bbox = {};

    $scope.width = 200;
    $scope.height = 200;

    $scope.featureLimit = 50;

    // Produce an angular request object
    function request() {
      window.bbox = $scope.bbox;
      var params = {
        service: $scope.serviceType,
        request: $scope.requestType,
        outputFormat: $scope.format,
        format: $scope.format,
      };

      if (!$.isEmptyObject($scope.bbox))
        params.bbox = [$scope.bbox.minx, $scope.bbox.miny, $scope.bbox.maxx, $scope.bbox.maxy].join();

      if (params.service == "WMS") {
        params.layers = $scope.layer ? $scope.layer.Title : undefined;
        params.width = $scope.width;
        params.height = $scope.height;
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
        if ($scope.serviceType == "WMS") {
          var cap = $.xml2json(xml).Capability;
          var requestTypes = cap.Request;
          for (var rt in requestTypes)
            requestTypes[rt].formats = requestTypes[rt].Format;
          var layers = cap.Layer.Layer;

          $scope.requestTypes = requestTypes;
          $scope.layers = layers;
        }
        if ($scope.serviceType == "WFS") {
          var requestTypes = {};
          $(xml)
            .find('ows\\:operationsmetadata')
            .children('ows\\:operation')
            .each(function() {
              var op = $(this);
              var name = op.attr("name");
              var formats = [];
              op.find('ows\\:parameter[name="outputFormat"]')
                .children().children().each(function() {
                  formats.push($(this).text());
                });
              requestTypes[name] = {formats: formats};
            });

          var featureTypes = [];
          $(xml)
            .find('featuretypelist')
            .children('featuretype')
            .children('name')
            .each(function() {
              featureTypes.push($(this).text());
            });

          $scope.requestTypes = requestTypes;
          $scope.typeNames = featureTypes;
        }
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
