var builder = angular.module("builder", [
  "ngRoute", "builder-request", "builder-capabilities",
]);

/* Filter an array by the objects in another array */
builder.filter("isIn", function() {
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

builder.value("hosts", {
  "NICTA - GeoTopo250K": "http://geospace.research.nicta.com.au:8080/geotopo_250k",
  "NICTA - Admin Bounds": "http://geospace.research.nicta.com.au:8080/admin_bnds",
});

builder.value("serviceTypes", [
  "WMS",
  "WFS",
]);

builder.controller("builder", ["$scope", "$http",
  "requestCapabilities", "processCapabilities",
  "geoRequest", "geoImage", "imageWidth",
  "hosts", "serviceTypes",
  function($scope, $http, requestCapabilities, processCapabilities, request, getImageURL, getImageWidth, hosts, serviceTypes) {
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


    // Create a URL for the request
    $scope.url = function(override) {
      var req = request($scope);
      return req.url + "?" + $.param(req.params);
    }

    // Create an image link for the request
    $scope.image = function() {
      getImageURL($scope, 200);
    };

    // Get the capabilities of the current WMS/WFS server selection
    function updateCapabilities(updated) {
      // Reset old features if there is a new host
      if ($scope.host == updated) {
        $scope.features = undefined;
        $scope.feature = undefined;
      }

      // Get the new capabilities
      var req = request($scope);

      requestCapabilities(req).success(function(xml) {
        // Apply capabilities to the scope
        var cap = processCapabilities($scope.serviceType, xml);
        angular.extend($scope, cap);
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
