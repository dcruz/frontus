
var app = angular.module('HomeApp', ['ngResource', 'ui.bootstrap', 'ui.event', 'nav', 'brijj', 'ownerServices', 'd3', 'homeDirectives']);

/** @name $routeParams#msg
 *  @type {string}
 */
//this is used to assign the correct template and controller for each URL path
app.config(function($routeProvider, $locationProvider){
    $locationProvider.html5Mode(true).hashPrefix('');

    $routeProvider.
        when('/investor', {controller: 'InvestorCtrl', templateUrl:'investor.html'}).
        when('/company', {controller: 'CompanyCtrl', templateUrl:'company.html'}).
        otherwise({redirectTo:'/investor'});
});

app.controller('CompanyCtrl', ['$scope','$rootScope','$route','$location', '$routeParams','SWBrijj', 'navState', 'calculate',
    function($scope, $rootScope, $route, $location, $routeParams, SWBrijj, navState, calculate) {

        $scope.statelist = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
        $scope.currencies = ['United States Dollars (USD)', 'Pound Sterling (GBP)', 'Euro (EUR)'];
        $scope.dateformats = ['MM/DD/YYYY', 'DD/MM/YYYY'];
        $scope.flipped1 = false;
        $scope.flipped2 = false;

        if (navState.role == 'investor') {
            $location.path('/investor');
            return;
        }

        SWBrijj.tblm('account.my_company', ['name', 'company', 'zipcode', 'state', 'address', 'city', 'currency', 'dateformat']).then(function(x) {
            $scope.company = x[0];
            angular.forEach($scope.currencies, function(c) {
               if (c.indexOf($scope.company.currency) !== -1) {
                   $scope.company.longcurrency = c;
               }
            });
            $scope.company.dateformat = $scope.company.dateformat == 'MM/dd/yyyy' ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
            $scope.photoURL = '/photo/user?id=company:' + x[0].company;

            // Get all the data required
            $scope.getDocumentInfo();
            $scope.getOwnershipInfo();
            $scope.getActivityFeed();
        });

        if ($routeParams.msg) {
            if ($routeParams.msg == "resetPassword") {
                $scope.$emit("notification:success", "You have successfully changed your password.");
            }
        }

        $scope.close = function() {
            $scope.onboarding = false;
            SWBrijj.procm('account.onboarding_update', false);
        };

        $scope.getDocumentInfo = function() {
            SWBrijj.tblm('document.my_company_library', ['doc_id']).then(function(docs) {
                $scope.docsummary = {};
                $scope.docsummary.num = docs.length;
                SWBrijj.tblm("document.my_counterparty_library").then(function(sharedocs) {
                    $scope.docsummary.sig = 0;
                    $scope.docsummary.counter = 0;
                    angular.forEach(sharedocs, function(doc) {
                        if (doc.signature_status == "signature requested (awaiting investor)") {
                            $scope.docsummary.sig += 1;
                        }
                        else if (doc.signature_status == "signed by investor (awaiting countersignature)") {
                            $scope.docsummary.counter += 1;
                        }
                    });
                });
            });
        };

        $scope.getOwnershipInfo = function() {
            $scope.ownersummary = {};
            $scope.rows = [];
            $scope.uniquerows = [];
            SWBrijj.tblm('ownership.company_transaction').then(function (trans) {
                $scope.ownersummary.people = [];
                $scope.ownersummary.invested = 0;
                $scope.trans = trans;
                angular.forEach(trans, function(tran) {
                    if ($scope.ownersummary.people.indexOf(tran.investor) == -1) {
                        $scope.ownersummary.people.push(tran.investor);
                    }
                    $scope.ownersummary.invested = tran.amount ? $scope.ownersummary.invested + tran.amount : $scope.ownersummary.invested;
                });
                SWBrijj.tblm('ownership.company_issue').then(function (data) {
                    $scope.issues = data;
                    SWBrijj.tblm('ownership.company_grants').then(function (grants) {
                        $scope.grants = grants;

                        angular.forEach($scope.grants, function (grant) {
                            angular.forEach($scope.trans, function (tran) {
                                if (grant.tran_id == tran.tran_id) {
                                    grant.investor = tran.investor;
                                    if (grant.action == "forfeited") {
                                        if (tran.forfeited) {
                                            tran.forfeited = tran.forfeited + grant.unit;
                                        }
                                        else {
                                            tran.forfeited = grant.unit;
                                        }
                                    }
                                }
                            });
                        });

                        for (var i = 0, l = $scope.trans.length; i < l; i++) {
                            if ($scope.uniquerows.indexOf($scope.trans[i].investor) == -1) {
                                $scope.uniquerows.push($scope.trans[i].investor);
                                $scope.rows.push({"name": $scope.trans[i].investor, "email": $scope.trans[i].email});
                            }
                        }

                        angular.forEach($scope.trans, function (tran) {
                            angular.forEach($scope.rows, function (row) {
                                if (row.name == tran.investor) {
                                    if (tran.issue in row) {
                                        row[tran.issue]["u"] = calculate.sum(row[tran.issue]["u"], tran.units);
                                        row[tran.issue]["a"] = calculate.sum(row[tran.issue]["a"], tran.amount);
                                        if (!isNaN(parseFloat(tran.forfeited))) {
                                            row[tran.issue]["u"] = calculate.sum(row[tran.issue]["u"], (-tran.forfeited));
                                        }
                                    }
                                    else {
                                        row[tran.issue] = {};
                                        row[tran.issue]["u"] = tran.units;
                                        row[tran.issue]["a"] = tran.amount;
                                        if (!isNaN(parseFloat(tran.forfeited))) {
                                            row[tran.issue]["u"] = calculate.sum(row[tran.issue]["u"], (-tran.forfeited));
                                            row[tran.issue]["ukey"] = row[tran.issue]["u"];
                                        }
                                    }
                                }
                            });
                        });

                        angular.forEach($scope.rows, function (row) {
                            angular.forEach($scope.issues, function (issue) {
                                if (row[issue.issue] != undefined) {
                                    if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u']))) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                                        row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                                    }
                                }
                            });
                        });
                        $scope.issuepercent = {};
                        angular.forEach($scope.issues, function (issue) {
                            $scope.issuepercent[issue.issue] = {'units':0,'debt':0};
                            $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(issue.issue));
                        });
                        var totalunits = 0;
                        var totaldebt = 0;
                        angular.forEach($scope.rows, function (row) {
                            angular.forEach($scope.issues, function (issue) {
                                if (row[issue.issue]) {
                                    if (row[issue.issue]['u']) {
                                        totalunits += row[issue.issue]['u'];
                                        $scope.issuepercent[issue.issue]['units'] += row[issue.issue]['u'];
                                    }
                                    if (row[issue.issue]['x']) {
                                        totaldebt += row[issue.issue]['x'];
                                        $scope.issuepercent[issue.issue]['debt'] += row[issue.issue]['x'];
                                    }
                                }
                            });
                        });
                        $scope.graphdata = [];
                        console.log(totalunits);
                        console.log(totaldebt);
                        angular.forEach($scope.issues, function (issue) {
                            var issuepercent = $scope.issuepercent[issue.issue]['debt'] + (($scope.issuepercent[issue.issue]['units'] / totalunits) * (100-totaldebt));
                            $scope.graphdata.push({'name':issue.issue, 'percent':issuepercent});
                        });

                        console.log($scope.graphdata);

                    });
                });
                $scope.ownersummary.peoplenum = $scope.ownersummary.people.length;
            });
            SWBrijj.tblm("ownership.clean_company_access").then(function (people) {
                $scope.ownersummary.shares = people.length;
            });
        };

        $scope.getActivityFeed = function() {
            $scope.activity = [];
            SWBrijj.tblm('global.get_company_activity').then(function(feed) {
                var originalfeed = feed;
                //Generate the groups for the activity feed
                $scope.eventGroups = [];
                var uniqueGroups = [];
                angular.forEach(originalfeed, function(event) {
                    if (event.activity != "sent") {
                        var timegroup = moment(event.time).fromNow();
                        if (uniqueGroups.indexOf(timegroup) > -1) {
                            $scope.eventGroups[uniqueGroups.indexOf(timegroup)].push(event);
                        }
                        else {
                            $scope.eventGroups[$scope.eventGroups.length] = [];
                            $scope.eventGroups[$scope.eventGroups.length-1].push(timegroup);
                            $scope.eventGroups[$scope.eventGroups.length-1].push(event.time);
                            $scope.eventGroups[$scope.eventGroups.length-1].push(event);
                            uniqueGroups.push(timegroup);
                        }
                    }
                });
            });
        };

        $scope.activityOrder = function(card) {
            return -card.time;
        };

        // Flipping tiles functionality

        $scope.flipTile = function(x) {
            $scope['flipped'+String(x)] = !$scope['flipped'+String(x)];
        };


        // Profile Change modal

        $scope.profileModalOpen = function () {
            $scope.profileModal = true;
            $scope.editcompany = angular.copy($scope.company);
        };

        $scope.profileModalClose = function () {
            $scope.profileModal = false;
        };

        $scope.profileopts = {
            backdropFade: true,
            dialogFade:true,
            dialogClass: 'profile-modal modal'
        };

        $scope.setFiles = function(element) {
            $scope.files = [];
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i]);
                var oFReader = new FileReader();
                oFReader.readAsDataURL($scope.files[0]);

                oFReader.onload = function (oFREvent) {
                    document.getElementById("updateImage").src = oFREvent.target.result;
                };
                $scope.$apply();
            }
        };

        $scope.profileUpdate = function (company) {
            SWBrijj.proc("account.company_update", company.name, company.address, company.city, company.state, company.zipcode).then(function (x) {
                void(x);
                var fd = new FormData();
                if ($scope.files) {
                    for (var i=0;i<$scope.files.length;i++) fd.append("uploadedFile", $scope.files[i]);
                    SWBrijj.uploadLogo(fd).then(function(x) {
                        void(x);
                        console.log("here");
                        $scope.photoURL = '/photo/user?id=company:' + $scope.company.company;
                        $scope.$emit("notification:success", "Company profile successfully updated");
                        $scope.company = company;
                    }).except( function(x) {
                            void(x);
                            $scope.$emit("notification:fail", "Company logo change was unsuccessful, please try again.");
                        });
                }
                else {
                    $scope.company = company;
                    $scope.$emit("notification:success", "Company profile successfully updated");
                }
            }).except(function(x) {
                    void(x);
                    $scope.$emit("notification:fail", "There was an error updating your company profile.");
                });
        };

        // Settings Change modal

        $scope.settingModalOpen = function () {
            $scope.settingModal = true;
            $scope.editcompany = angular.copy($scope.company);
        };

        $scope.settingModalClose = function () {
            $scope.settingModal = false;
        };

        $scope.setCurrency = function(currency) {
            $scope.editcompany.longcurrency = currency;
            $scope.editcompany.currency = currency.match(/\(...\)/)[0].substring(1,4);
        };

        $scope.setDateFormat = function(dateformat) {
            $scope.editcompany.dateformat = dateformat;
        }

        $scope.saveSettings = function(company) {
            var dateformat = company.dateformat == 'MM/DD/YYYY' ? 'MM/dd/yyyy' : 'dd/MM/yyyy';
            SWBrijj.proc("account.company_settings_update", company.currency, dateformat).then(function (x) {
                void(x);
                $scope.company.longcurrency = company.longcurrency;
                $scope.company.currency = company.currency;
                $scope.company.dateformat = company.dateformat;
            });
        };

        $scope.gotopage = function (link){
            location.href = link;
        };

        // Service functions

        $scope.formatAmount = function (amount) {
            return calculate.funcformatAmount(amount);
        };

        $scope.formatDollarAmount = function(amount) {
            var output = calculate.formatMoneyAmount($scope.formatAmount(amount), $scope.settings);
            return (output);
        };
    }]);

app.controller('InvestorCtrl', ['$scope','$rootScope','$location', '$route','$routeParams', 'SWBrijj', 'navState',
    function($scope, $rootScope, $location, $route, $routeParams, SWBrijj, navState) {

        if (navState.role == 'issuer') {
            $location.path('/company');
            return;
        }

        if ($routeParams.msg) {
            if ($routeParams.msg == "resetPassword") {
                $scope.$emit("notification:success", "You have successfully changed your password.");
            }
        }
        //$scope.company = $routeParams.company;
        $scope.company = navState.name;
        $scope.activity = [];
        SWBrijj.tblm('global.get_investor_activity').then(function(data) {
            $scope.activity = data;
            if ($scope.activity.length == 0) {
                $scope.noActivity = true;
            }
        }).except(function(msg) {
                // console.log(msg.message);
            });

        $scope.activityOrder = function(card) {
            return -card.time;
        };
    }]);

app.controller('HomeCtrl',['$scope','$route', 'SWBrijj', function($scope, $route, SWBrijj) {
    SWBrijj.tbl('account.companies').then(function(x) {
        // console.log(x);
        if (x.length > 0) { //User is a CEO of a company
            document.location.href="company";
        } else {
            SWBrijj.tblm('account.invested_companies').then(function(x) {
                document.location.href=x[0]['company'];
            })
        }
    });
}]);

/*
 function initPage($scope, x, row) {
 if(typeof(row)==='undefined') row = 1;
 var y = x[0]; // the fieldnames
 var z = x[row]; // the values

 for(var i=0;i<y.length;i++) { if (z[i] !== null) { $scope[y[i]]=z[i]; } }
 $scope.$apply();
 } */

function initFail(x) {
    void(x);
    // console.log('I would have redirected to login'); // document.location.href='/login';
}

/************************************************************
 *  Filters
 *  *********************************************************/

/* Filter to format the activity time */
angular.module('HomeApp').filter('fromNow', function() {
    return function(date) {
        return moment(date).fromNow();
    }
});

/* Filter to select the activity icon for document status */
angular.module('HomeApp').filter('icon', function() {
    return function(activity) {
        if (activity == "sent") return "icon-email";
        else if (activity == "received") return "icon-email";
        else if (activity == "viewed") return "icon-view";
        else if (activity == "reminder") return "icon-redo";
        else if (activity == "edited") return "icon-pencil";
        else if (activity == "signed") return "icon-pen";
        else if (activity == "uploaded") return "icon-star";
        else if (activity == "rejected") return "icon-circle-delete";
        else if (activity == "countersigned") return "icon-countersign";
        else return "hunh?";
    }
});

/* Filter to format the activity description on document status */
angular.module('HomeApp').filter('description', function() {
    return function(ac) {
        var activity = ac.activity;
        var person;
        if (ac.name) {
            person = ac.name;
        }
        else {
            person = ac.email;
        }
        var type = ac.type;
        if (type == "ownership") {
            if (activity == "received") return "Ownership Table sent to " + person;
            else if (activity == "viewed") return "Ownership Table viewed by "+person;
            else return "Something with Ownership Table";
        }
        else {
            var document = ac.docname;
            if (activity == "sent") return "";
            else if (activity == "viewed") return document + " viewed by "+person;
            else if (activity == "reminder") return "Reminded "+person + " about " +document;
            else if (activity == "edited") return document + " edited by "+person;
            else if (activity == "signed") return document + " signed by "+person;
            else if (activity == "uploaded") return document + " uploaded by "+person;
            else if (activity == "received") return document + " sent to "+person;
            else if (activity == "rejected") return "Signature on " +document + " rejected by "+person;
            else if (activity == "countersigned") return document + " countersigned by "+person;
            else return activity + " by "+person;
        }
    }
});

/* Filter to format the activity description on document status */
angular.module('HomeApp').filter('investordescription', function() {
    return function(ac) {
        var activity = ac.activity;
        var company = ac.company_name;
        if (company == null) {
            company = ac.company;
        }
        var person;
        if (ac.name) {
            person = ac.name;
        }
        else {
            person = ac.email;
        }
        var type = ac.type;
        if (type == "ownership") {
            if (activity == "received") return "You received " + company + "'s captable";
            else if (activity == "viewed") return "You viewed " + company + "'s captable";
            else return "Something happened with "+company +"'s captable";
        }
        else if (type == "document") {
            var document = ac.docname;
            if (activity == "received") return "You received " + document + " from " + company;
            else if (activity == "viewed") return "You viewed " + document;
            else if (activity == "reminder") return "You were reminded about" +document;
            else if (activity == "signed") return "You signed "+document;
            else if (activity == "rejected") return person + " rejected your signature on " +document;
            else if (activity == "countersigned") return person + " countersigned "+document;
            else  {
                return activity + " by "+person;
            }
        }
        else {
            return "";
        }
    }
});

// Filters

app.filter('fromNowSort', function () {
    return function (events) {
        if (events) {
            events.sort(function (a, b) {
                if(a[1] > b[1]) return -1;
                if(a[1] < b[1]) return 1;
                return 0;
            });
        }

        return events
    };
});