var directives = angular.module("builder-directives", []);

directives.directive("builderSection", function() {
  return {
    templateUrl: 'partials/builder-section.html',
    restrict: 'A',
    transclude: true,
    scope: {},
    controller: function($scope) {
    },
    link: function(scope, element, attrs, ctrl) {
    },

  };
});
