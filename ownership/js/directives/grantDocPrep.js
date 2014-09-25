'use strict';

function initDocInfo ($scope, grants) {
    // we can assume that grants contains an issue with grant docs that've been suitable marked up by now
    $scope.issue = grants.issue;
    var cancelIssueWatch = $scope.$watchCollection('issue', function(issue_arr) {
        if (issue_arr.length > 0) {
            cancelIssueWatch();
            // resync the docShare object
            var issue_docs = [];
            grants.issue[0].getDocs();
            var cancelDocsWatch = $scope.$watch(function() {
                return grants.issue[0].docs;
            }, function(tmp_issue_docs) {
                if (Object.keys(tmp_issue_docs).length > 0) {
                    cancelDocsWatch();
                    Object.keys(grants.issue[0].getDocs()).forEach(function(key) {
                        issue_docs.push(grants.issue[0].docs[key].doc_id);
                    });
                    // remove any existing doc to be shared that's no longer associated with the issue
                    grants.docsshare.documents.forEach(function(ds_doc) {
                        if (issue_docs.indexOf(ds_doc.doc_id) == -1) {
                            grants.docsshare.removeShareItem(ds_doc);
                        }
                    });
                    // add docs from the issue (or update, if they're already there)
                    Object.keys(grants.issue[0].docs).forEach(function(key) {
                        grants.docsshare.upsertShareItem(grants.issue[0].docs[key]);
                    });
                }
            }, true);
        }
    });

    $scope.docs = grants.docsshare.documents;
    $scope.emails = grants.docsshare.emails;
}

app.directive('grantDocPrep', [function() {
    return {
        restrict: "E",
        scope: {
        },
        templateUrl: '/ownership/partials/grantDocPrep.html',
        controller: ["$scope", "grants", "Documents", function($scope, grants, Documents) {
            initDocInfo($scope, grants);
            $scope.doc_arr = [];
            $scope.$watchCollection('docs', function(docs) {
                docs.forEach(function(sharedoc) {
                    var doc = Documents.getOriginal(sharedoc.doc_id);
                    doc.getPreparedFor(grants.docsshare.emails); // fetch preparation information (if needed)
                    $scope.doc_arr.push(doc);
                });
            });
            $scope.recipientSelectOptions = {
                data: [{id: 1, text: "Hello"}, {id: 2, text: "world"}]
            };
        }]
    };
}]);

app.directive('grantDocReview', [function() {
    return {
        restrict: "E",
        scope: {
        },
        templateUrl: '/ownership/partials/grantDocReview.html',
        controller: ["$scope", "grants", function($scope, grants) {
            initDocInfo($scope, grants);
        }]
    };
}]);