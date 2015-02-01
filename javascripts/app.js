var tradeDocs = angular.module('trade', ['ngRoute', 'ui.bootstrap'])
        .config(['$routeProvider', function ($routeProvider) {
                $routeProvider
                        .when('/home', {
                            templateUrl: 'home.html'
                })
                        .when('/concepts', {
                            templateUrl: 'concepts.html'
                        })
                        .otherwise({
                            redirectTo: '/home'
                        });
            }
        ]);

