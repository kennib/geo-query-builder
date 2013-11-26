var builder = angular.module("builder", [
  "ngRoute", "builder-request", "builder-capabilities",
]);

/* Filter an array by the objects in another array */
builder.filter("isIn", function() {
  function isIn(obj, array) {
    return array && (array.indexOf(obj) != -1 || array[obj] !== undefined);
  };

  return function(obj, filterArray) {
    var newObj = {};
    
    for (var key in obj) {
      if (isIn(key, filterArray) || isIn(obj[key], filterArray))
        newObj[key] = obj[key];
    }

    return newObj;
  };
});

builder.value("hosts", {
  "NICTA - GeoTopo250K": "http://envirohack.research.nicta.com.au/geotopo_250k",
  "NICTA - Admin Bounds": "http://envirohack.research.nicta.com.au/admin_bnds_abs",
  "NICTA - FSDF": "http://envirohack.research.nicta.com.au/fsdf",
  "Atlas of Living Australia": "http://spatial.ala.org.au/geoserver/ALA",
});

builder.value("serviceTypes", [
  "WMS",
  "WFS",
]);

builder.controller("builder", ["$scope", "$http",
  "requestCapabilities", "processCapabilities",
  "geoRequest", "geoCURL", "geoImage", "geoFeatureInfo", "processFeatureInfo",
  "imageWidth", "imageHeight",
  "hosts", "serviceTypes",
  function($scope, $http,
    requestCapabilities, processCapabilities,
    request, getCURL, getImageURL, getFeatureInfo, processFeatureInfo,
    getImageWidth, getImageHeight,
    hosts, serviceTypes
  ) {

    $scope.hosts = hosts;
    $scope.host = hosts["NICTA - Admin Bounds"];

    $scope.serviceTypes = serviceTypes;
    $scope.serviceType = serviceTypes[0];

    $scope.manualEntry = false;
    $scope.timeout = 3000; // 3 seconds

    // Default to Australian bounds
    $scope.bbox = {
      minx: 96.816941408,
      miny: -43.74050960205765,  
      maxx: 159.109219008,
      maxy: -9.142175976703609,
    };

    $scope.image = {
      width: 200,
      height: 200,
      proportional: true,
    };

    $scope.featureLimit = 50;

    // Function to generate a request
    $scope.request = function() {
      return request($scope);
    };

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

    // Create curl text
    $scope.CURL = function() {
      return getCURL($scope);
    }

    // Create a URL for the request
    $scope.url = function(override) {
      var req = request($scope);
      return req.url + "?" + $.param(req.params);
    }

    // Create an image link for the request
    $scope.imageURL = function() {
      getImageURL($scope, 200);
    };

    // Get the capabilities of the current WMS/WFS server selection
    function updateCapabilities(updated) {
      // Reset old features if there is a new host
      if ($scope.host == updated) {
        $scope.features = undefined;
        $scope.feature = undefined;
        $scope.featureList = undefined;
      }

      // Get the new capabilities
      if ($scope.host) {
        requestCapabilities($scope).success(function(xml) {
          // Apply capabilities to the scope
          var cap = processCapabilities($scope.serviceType, xml);
          angular.extend($scope, cap);
          $scope.capabilitiesError = null;
        }).error(function(error) {
          $scope.capabilitiesError = error? error : "Unable to retrieve the server's capabilities.";
        });
      }
    };
    // Update capabilities if the host or service type changes
    $scope.$watch('host', updateCapabilities);
    $scope.$watch('serviceType', updateCapabilities);

    // Update the list of features for this host
    $scope.$watch('host', function() {
      getFeatureInfo($scope).success(function(xml) {
        $scope.featureInfo = processFeatureInfo(xml);
        $scope.capabilitiesError = null;
      }).error(function(error) {
        $scope.capabilitiesError = error? error: "Unable to retreive the feature's properties";
      });
    });

    // Update the bounding box based on the layer/feature selection
    function updateBBox(feature) {
      if (feature && $scope.updateBbox) {
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
    // Update the features when a feature is selected
    $scope.$watch('feature', function(feature) {
      if (feature) {
        $scope.features = [feature];
      }
    });
    
    // Update the width when the height or bbox changes
    // Update the height when the width changes
    function updateImageDimensions(newimg, oldimg) {
      newimg = angular.copy(newimg); // avoid changing the newimg data

      if (oldimg && $scope.image.proportional && !$scope.autoResizing) {
        var bboxChanged = newimg.width === undefined;
        var propChanged = newimg.proportional !== oldimg.proportional;

        // Update height if width changed or bbox is changed or propotionality changed
        if (bboxChanged || propChanged || newimg.width !== oldimg.width)
          $scope.image.height = getImageHeight($scope.bbox, $scope.image.width);

        // Update width if height changed
        if (newimg.height !== oldimg.height)
          $scope.image.width = getImageWidth($scope.bbox, $scope.image.height);

        $scope.autoResizing = true;  // stop the next update
      } else {
        $scope.autoResizing = false; // this update doesn't do anything, but the next update will
      }
    }
    $scope.$watch('image', updateImageDimensions, true);
    $scope.$watch('bbox', updateImageDimensions);
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
    editable: true,
    draggable: true,
  });

  rectangle.setMap(map);

  return {map: map, rectangle: rectangle};
}
