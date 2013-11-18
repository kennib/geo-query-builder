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
]);

wmsBuilder.value("defaults", {
  WMS: {
    requestType: "GetMap", 
    format: "image/png",
  },
  WFS: {
    requestType: "GetFeature",
    format: "json",
  },
});

wmsBuilder.controller("builder", ["$scope", "$http",
  "getCapabilities",
  "hosts", "serviceTypes", "defaults",
  function($scope, $http, getCapabilities, hosts, serviceTypes, defaults) {
    $scope.hosts = hosts;
    $scope.host = hosts["NICTA - Admin Bounds"];

    $scope.serviceTypes = serviceTypes;
    $scope.serviceType = serviceTypes[0];

    // Default to Australian bounds
    $scope.bbox = {
      minx: 96.816941408,
      miny: -43.74050960205765,  
      maxx: 159.109219008,
      maxy: -9.142175976703609,
    };

    $scope.width = 200;
    $scope.height = 200;

    $scope.featureLimit = 50;

    // Initialize the Google map
    var map = initMap();
    // Update bounds on map rectangle update
    function updateMapBounds(bounds) {
      var ne = map.rectangle.getBounds().getNorthEast();
      var sw = map.rectangle.getBounds().getSouthWest();
      
      $scope.bbox = {
        minx: sw.lng(),
        maxx: ne.lng(),
        miny: sw.lat(),
        maxy: ne.lat(),
      };

      $scope.$apply('bbox');
    }
    var boundsListener = google.maps.event.addListener(map.rectangle, 'bounds_changed',updateMapBounds);
    // Update rectangle on bounds update
    $scope.$watch('bbox', function(bbox) {
      var ne = map.rectangle.getBounds().getNorthEast();
      var sw = map.rectangle.getBounds().getSouthWest();

      if (bbox && bbox.minx && bbox.maxx && bbox.miny && bbox.maxy) {
        var bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(bbox.miny, bbox.minx),
          new google.maps.LatLng(bbox.maxy, bbox.maxx)
        );

        // Add and remove listener to stop an infinite update loop
        // between the map and the bounds inputs
        google.maps.event.removeListener(boundsListener);
        map.rectangle.setOptions({bounds: bounds}); // do the update
        boundsListener = google.maps.event.addListener(map.rectangle, 'bounds_changed',updateMapBounds);
      }
    });

    // Produce an angular request object
    function request(overrideParams) {
      window.bbox = $scope.bbox;
      var params = {
        service: $scope.serviceType,
        request: $scope.requestType,
        outputFormat: $scope.format,
        format: $scope.format,
      };
      
      // Override the paramaters
      params = angular.extend(params, overrideParams);

      if (!$.isEmptyObject($scope.bbox) && params.request != "GetCapabilities") {
        if (params.service == "WMS")
          params.bbox = [$scope.bbox.minx, $scope.bbox.miny, $scope.bbox.maxx, $scope.bbox.maxy].join();
        if (params.service == "WFS")
          params.bbox = [$scope.bbox.miny, $scope.bbox.minx, $scope.bbox.maxy, $scope.bbox.maxx].join();
      }

      if (params.service == "WMS" && params.request != "GetCapabilities") {
        params.layers = $scope.features ? $scope.features.join() : undefined;
        params.width = $scope.width;
        params.height = $scope.height;
      }
      if (params.service == "WFS" && params.request != "GetCapabilities") {
        params.typeName = $scope.feature;
        params.maxFeatures = $scope.featureLimit;
      }

      // Override the paramaters
      params = angular.extend(params, overrideParams);

      var request = {
        method: "GET",
        headers: {},
        url: $scope.host + "/ows",
        params: params,
      };

      return request;
    }

    // Create a URL for the request
    $scope.url = function(override) {
      var req = request();
      return req.url + "?" + $.param(req.params);
    }
    // Create an image link for the request
    $scope.image = function(height) {
      // Only map if there are features to map
      if ($scope.features || $scope.freature) {
        var imageParams = {
          service: "WMS",
          request: "GetMap",
          outputFormat: "image/png",
          format: "image/png",
          width: getImageWidth($scope.bbox, height),
          height: height,
          layers: $scope.service=="WMS"? $scope.features : $scope.feature,
        };
        var req = request(imageParams);
        return req.url + "?" + $.param(req.params);
      } else {
        return "";
      }
    }

    // Get the capabilities of the current WMS/WFS server selection
    function updateCapabilities() {
      var req = request();

      getCapabilities(req).success(function(xml) {
        if ($scope.serviceType == "WMS") {
          var cap = $.xml2json(xml).Capability;
          var requestTypes = cap.Request;
          for (var rt in requestTypes) {
            var formats = requestTypes[rt].Format;

            if (typeof(formats) != typeof([]))
              requestTypes[rt].formats = [formats];
            else
              requestTypes[rt].formats = formats;
          }
          var layers = [];
          var Layer = cap.Layer.Layer;
          for (var l in Layer) {
            var layer = {
              bbox: Layer[l].BoundingBox[0],
              name: Layer[l].Name,
            };
            layers[layer.name] = layer;
          }

          $scope.requestTypes = requestTypes;
          $scope.featureList = layers;
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
            .each(function() {
              var feature = $(this);
              var name = feature .children('name').text();
              var box = feature.children('ows\\:wgs84boundingbox');
              var min = box.children('ows\\:lowercorner').text().split(' ');
              var max = box.children('ows\\:uppercorner').text().split(' ');
              var bbox = {minx: min[0], maxx: max[0], miny: min[1], maxy: max[1]};
              featureTypes[name] = {name: name, bbox: bbox};
            });

          $scope.requestTypes = requestTypes;
          $scope.featureList = featureTypes;
        }
        
        var def = defaults[$scope.serviceType];
        $scope.requestType = def.requestType;
        $scope.format = def.format;
      });
    };

    // Update capabilities if the host or service type changes
    $scope.$watch('host', updateCapabilities);
    $scope.$watch('serviceType', updateCapabilities);

    // Update the bounding box based on the layer/feature selection
    function updateBBox(feature) {
      if (feature) {
        var bbox = $scope.featureList[feature].bbox;
        $scope.bbox = bbox;
      }
    }
    $scope.$watch('feature', updateBBox);

    // Update the feature when features are selected
    $scope.$watch('features', function(features) {
      if (features && features.length > 0) {
        $scope.feature = features[0];
      }
    });

    // Get the proportional image width based on bounding box dimensions and given height
    function getImageWidth(bbox, height) {
      if (bbox) {
        var w = Math.abs(bbox.minx - bbox.maxx);
        var h = Math.abs(bbox.miny - bbox.maxy);
        var ratio = w/h;

        return parseInt(height * ratio);
      }
    }
    
    // Update the width when the bbox changes
    function updateImageWidth(bbox) {
      $scope.width = getImageWidth($scope.bbox, $scope.height);
    }
    $scope.$watch('bbox', updateImageWidth);
  }]);

function initMap() {
  var mapOptions = {
    center: new google.maps.LatLng(-31.952162,135.175781), // Australia
    zoom: 1,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  var map = new google.maps.Map(document.getElementById("map"), mapOptions);

  var rectangle = new google.maps.Rectangle({
    bounds: new google.maps.LatLngBounds(),
    editable: true
  });

  rectangle.setMap(map);

  return {map: map, rectangle: rectangle};
}
