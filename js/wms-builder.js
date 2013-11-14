var wmsBuilder = angular.module("wms-builder", [
  "ngRoute",
]);

wmsBuilder.value("hosts", {
  "NICTA - GeoTopo250K": "http://geospace.research.nicta.com.au:8080/geotopo_250k/web/ows",
  "NICTA - Admin Bounds": "http://geospace.research.nicta.com.au:8080/admin_bnds/web/ows",
});

wmsBuilder.value("serviceTypes", {
  "WMS": "WMS",
  "WFS": "WFS",
});

wmsBuilder.controller("builder", ["$scope",
  "hosts", "serviceTypes",
  function($scope, hosts, serviceTypes) {
    $scope.hosts = hosts;
    $scope.host = hosts["NICTA - Admin Bounds"];

    $scope.serviceTypes = serviceTypes;
    $scope.serviceType = serviceTypes["WMS"];

    $scope.url = function() {
      return $scope.host + '?' + 'service=' + $scope.serviceType;
    }
  }]);
