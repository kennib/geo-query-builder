var directives = angular.module("builder-directives", []);

directives.directive("builderSection", function() {
  return {
    templateUrl: 'partials/builder-section.html',
    restrict: 'A',
    replace: true,
    transclude: true,
    scope: {
      'title': '@',
      'icon': '@',
      'host': '@',
    },
    controller: function($scope, $attrs, $transclude) {
    },
  };
});
