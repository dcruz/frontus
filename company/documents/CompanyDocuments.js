'use strict';

/* App Module */

var docviews = angular.module('documentviews', ['ui.bootstrap']);

docviews.config(function($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true).hashPrefix('');
    
  $routeProvider.
      when('/', {templateUrl: 'docuview.html',   controller: documentListController}).
      when('/view', {templateUrl: 'docuviewer.html', controller: documentViewController}).
	  when('/status', {templateUrl: 'docustatus.html', controller: documentStatusController}).
      otherwise({redirectTo: '/'});
});

docviews.directive('draggable', function() {
  return {
    restrict: 'A',
    link: function(scope, elm, attrs) {
      var options = scope.$eval(attrs.draggable); //allow options to be passed in
      $(elm).draggable(options);
    }
  };
});

/* Controllers */

var documentListController = function($scope) {
	SWBrijj.procm("document.get_companydocs").then(function(data) {
	console.log(data)
	$scope.documents = data;
	$scope.$apply();
	});
	
	$scope.docOrder = 'docname';
	
	$scope.setOrder = function(field) {
		if ($scope.docOrder == field) {
			$scope.docOrder = ('-' + field);
		}
		else {
			$scope.docOrder = field;
		}
	}
			
	$scope.delete = function(docname) {
	  console.log(docname.docname);
	  SWBrijj.procm("document.delete_document", docname.docname).then(function(data) {
		  console.log(data);
		  console.log(docname);
		  $scope.documents.forEach(function(docu) {				  
			if (docname === docu)
				$scope.documents.splice($scope.documents.indexOf(docname),1);
			});
		});				  
	};		
};

function documentViewController($scope, $routeParams) {
  var docId = $routeParams.doc;
  $scope.currentDoc = docId;

  SWBrijj.procm("document.get_docmeta", parseInt(docId)).then(function(data) {
	$scope.documents = data[0];
	$scope.messageText = "Hi,\n Your signature is requested on " + $scope.documents.docname + "."
	$scope.$apply();
	});
  
  
  var imageObj = new Image();
  imageObj.src = "/photo/docpg?id="+docId+"&page=1";
  
  imageObj.onload = function() {
	  	var width = 1024;
		var scaling = (imageObj.height/imageObj.width)
		var height = (1024 * scaling)
		var n = 26;
		$scope.images = []
		for(var i=1; i<n; i++) {
			$scope.images.push({"src": "", "pagenum": i});
		};
		$scope.images[0].src = imageObj.src;
		$scope.currentPage = {"src": $scope.images[0].src, "pageNum": $scope.images[0].pagenum}
		$scope.images;
		$scope.$apply();
      };

	$scope.nextPage = function(value) {
		console.log(value);
		var pageRequired = parseInt(value) + 1;
		console.log(pageRequired);
		if ($scope.images[pageRequired-1].src == "") {
			$scope.images[pageRequired-1].src ='/photo/docpg?id='+$scope.currentDoc+'&page=' +pageRequired;
		}
		$scope.currentPage.src = ($scope.images[pageRequired-1].src)
		$scope.currentPage.pageNum = pageRequired;

	};

	$scope.previousPage = function(value) {
		var pageRequired = parseInt(value) - 1;
		if (pageRequired > 0) {
			if ($scope.images[pageRequired-1].src == "") {
				$scope.images[pageRequired-1].src ='/photo/docpg?id=' +$scope.currentDoc+'&page='+pageRequired;
			}
			$scope.currentPage.src = ($scope.images[pageRequired-1].src)
			$scope.currentPage.pageNum = pageRequired;
			}
	};

	$scope.jumpPage = function(value) {
		var pageRequired = value;
		if ($scope.images[pageRequired-1].src == "") {
			$scope.images[pageRequired-1].src ='/photo/docpg?id='+$scope.currentDoc+'&page=' +pageRequired;
		}
		$scope.currentPage.src = ($scope.images[pageRequired-1].src)
		$scope.currentPage.pageNum = pageRequired;

	};
	
	  $scope.share = function(message, email) {
		 SWBrijj.procm("document.share_document", parseInt(docId), email, message).then(function(data) {
				console.log(data);
			});
	};
}

function documentStatusController($scope, $routeParams) {
  var docId = $routeParams.doc;
  
  SWBrijj.procm("document.get_docdetail", parseInt(docId)).then(function(data) {
	$scope.document1 = data[0];
	console.log($scope.document1);
	$scope.$apply();
	});
	
  SWBrijj.procm("document.document_status", parseInt(docId)).then(function(data) {
	$scope.userStatus = data;
	$scope.$apply();
	});
}

/* Services */


/* Filters */

angular.module('documentviews').filter('fromNow', function() {
			return function(date) {
			  return moment(date).fromNow();
			}
		  });
		  
		  