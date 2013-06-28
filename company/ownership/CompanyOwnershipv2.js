'use strict';

/* App Module */

var owner = angular.module('companyownership', ['ui.bootstrap', 'ui.event', '$strap.directives']);

owner.config(function($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true).hashPrefix('');
    
  $routeProvider.
      when('/', {templateUrl: 'captable.html',   controller: captableController}).
      otherwise({redirectTo: '/'});
});

if(!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(needle) {
        for(var i = 0; i < this.length; i++) {
            if(this[i] === needle) {
                return i;
            }
        }
        return -1;
    };
}

owner.service('calculateauth', function() {
  this.adding = function(total, issue, rows) {
    var leftover = total
    angular.forEach(rows, function(row) {
      if (issue.issue in row && row.nameeditable != 0 && !isNaN(parseInt(row[issue.issue]['u']))) {
        leftover = leftover - row[issue.issue]['u'];
      }
    });
    return leftover
  };
});

owner.run(function($rootScope) {

/* Calculates the Total Shares owned by an investor across all rounds */
$rootScope.rowOrdering = function(row) {
  var total = 0
  for (var key in row) {
    if (row.hasOwnProperty(key)) {
      if (key != "name") {
        if (!isNaN(parseInt(row[key]['u'])) && String(key) != "$$hashKey") {
          total = total + parseInt(row[key]['u']);
        }
      }
    }
  }
  return -total;
  };

/* Calculates the Total Shares owned by an investor across all rounds */
$rootScope.shareSum = function(row) {
  var total = 0
  for (var key in row) {
    if (row.hasOwnProperty(key)) {
      if (key != "name") {
        if (parseInt(row[key]['u']) % 1 === 0 && String(key) != "$$hashKey" && row['nameeditable'] != 0) {
          total = total + parseInt(row[key]['u']);
        }
      }
    }
  }
  return total;
  };
  /* Calculates total shares */
  $rootScope.totalShares = function(rows) {
    var total = 0;
    angular.forEach(rows, function(row) {
      for (var key in row) {
        if (row.hasOwnProperty(key)) {
          if (key != "name") {
            if (parseInt(row[key]['u']) % 1 == 0 && String(key) != "$$hashKey" && row['nameeditable'] != 0) {
              total = total + parseInt(row[key]['u']);
            }
          };
        };
      };
    });
    return total;
  };

  $rootScope.sharePercentage = function(row, rows) {
      return ($rootScope.shareSum(row) / $rootScope.totalShares(rows) * 100);
    };

  $rootScope.colTotal = function(header, rows, type) {
      var total = 0;
      angular.forEach(rows, function(row) {
      for (var key in row) {
          if (key == header) {
            if (parseInt(row[key][type]) % 1 == 0 && String(key) != "$$hashKey") {
            total = total + parseInt(row[key][type]);
              }
          }
      };
    });
      return total;
    };

});

var captableController = function($scope, $parse, calculateauth) {
  $scope.issuetypes = [];
  $scope.freqtypes = [];
  $scope.issuekeys = [];
  $scope.tf = ["yes", "no"]
  SWBrijj.procm('ownership.get_issuetypes').then(function(results) {
    angular.forEach(results, function(result) {
        $scope.issuetypes.push(result['get_issuetypes']);
      });
  });
  SWBrijj.procm('ownership.get_freqtypes').then(function(results) {
    angular.forEach(results, function(result) {
        $scope.freqtypes.push(result['get_freqtypes']);
      });
  });
	$scope.issues = []
  $scope.issueSort = 'date';
  $scope.rowSort = '-name';
	$scope.rows = []
	$scope.uniquerows = []
  $scope.activeTran = []

  $scope.investorOrder = "name";
  
  SWBrijj.tblm('account.companies').then(function(comp) {
    $scope.company = comp[0]['company'];
  });
	SWBrijj.tblm('ownership.company_issue').then(function(data) {
		$scope.issues = data;
		angular.forEach($scope.issues, function(oneissue) {
	      oneissue.key = oneissue.issue;
        $scope.issuekeys.push(oneissue.key);
	    });
	    $scope.issues.push({"name":"", "date":Date(2100, 1, 1)})

		// Pivot shenanigans
		SWBrijj.tblm('ownership.company_transaction').then(function(trans) {
				$scope.trans = trans
        console.log(trans);
				angular.forEach($scope.trans, function(tran) {
				  tran.key = tran.issue;
          tran.datekey = tran['date'].toUTCString();
          tran.investorkey = tran.investor;
			      if ($scope.uniquerows.indexOf(tran.investor) == -1) {
			      	$scope.uniquerows.push(tran.investor);
			      	$scope.rows.push({"name":tran.investor, "namekey":tran.investor, "editable":"yes"});
			      }
			    });

        $scope.rows.push({"name":"", "editable":"0"});

			angular.forEach($scope.trans, function(tran) {
				angular.forEach($scope.rows, function(row) {
			      if (row.name == tran.investor) {
			      	if (tran.issue in row) {
			      		row[tran.issue]["u"] = row[tran.issue]["u"] + tran.units
                row[tran.issue]["a"] = row[tran.issue]["a"] + tran.amount
			      	}
			      	else {
              row[tran.issue] = {}
			      	row[tran.issue]["u"] = tran.units;
              row[tran.issue]["a"] = tran.amount;
			      	};
            }
            else {
              if (tran.issue in row) {
              }
              else {
                row[tran.issue] = {"u":null, "a":null};
              }
            };
			    });
		  });

      angular.forEach($scope.rows, function(row) {
        angular.forEach($scope.issuekeys, function(issuekey) {
          if (issuekey in row) {

          }
          else {
            row[issuekey] = {"u":null, "a":null};
          };
        });
      });

      angular.forEach($scope.issues, function(issue) {
        console.log(issue.issue);
        if (parseFloat(issue.totalauth) % 1 == 0) {
          var leftovers = calculateauth.adding(issue.totalauth, issue, $scope.rows);
          console.log(issue.totalauth);
          console.log(leftovers);
          if (leftovers != 0) {
            var issuename = String(issue.issue)
            var shares = {"u":leftovers};
            $scope.rows.push({"name":issuename+" (unissued)", "editable":0, "nameeditable":0});
            $scope.rows[($scope.rows.length)-1][issuename] = shares
          }
        }
      });
		$scope.$apply();
		});
	});

$scope.findValue = function(row, header) {
	angular.forEach($scope.rows, function(picked) {
		if (picked==row) {
			return $scope.rows[header];
		};
	});
};

$scope.getActiveTransaction = function(currenttran, currentcolumn) {
	$scope.sideBar = 2;
  $scope.activeTran = [];
  $scope.activeIssue = currentcolumn;
  $scope.activeInvestor = currenttran
	var first = 0
	angular.forEach($scope.trans, function(tran) {
		if (tran.investor == currenttran) {
      if (tran.issue == currentcolumn){
    		if (first == 0) {
    			tran['active'] = true
    			first = first + 1
        }
        if (String(tran['partpref']) == "true") {
          tran.partpref = $scope.tf[0];
        }
        else {
          tran.partpref = $scope.tf[1];
        }
        if (String(tran['liquidpref']) == "true") {
          tran.liquidpref = $scope.tf[0];
        }
        else {
          tran.liquidpref = $scope.tf[1];
        }
  			$scope.activeTran.push(tran);
      }
		}
	});
  if ($scope.activeTran.length < 1) {
    var newTran = {}
    newTran = {"active":true, "new":"yes", "investor":$scope.activeInvestor, "investorkey":$scope.activeInvestor, "company":$scope.company, "date":(Date.today()), "datekey":(Date.today()), "issue":($scope.activeIssue), "units":null, "paid":null, "key":undefined};
    $scope.trans.push(newTran);
    $scope.activeTran.push(newTran);
  }
	$scope.$apply();
};

$scope.getActiveIssue = function(issue) {
	$scope.sideBar = 1;
	$scope.activeIssue = issue;
  // Set Boolean Values for the Angularjs Select
  if (String($scope.activeIssue.partpref) == "true") {
    $scope.activeIssue.partpref = $scope.tf[0];
  }
  else {
    $scope.activeIssue.partpref = $scope.tf[1];
  }
  if (String($scope.activeIssue.liquidpref) == "true") {
    $scope.activeIssue.liquidpref = $scope.tf[0];
  }
  else {
    $scope.activeIssue.liquidpref = $scope.tf[1];
  }
  if ($scope.activeIssue.name == "") {
    $scope.activeIssue.date = (Date.today()).toUTCString();
  }
  // Set Freq Value for Angularjs Select
  var index = $scope.freqtypes.indexOf(issue.vestfreq);
  $scope.activeIssue.vestfreq = $scope.freqtypes[index];
	$scope.$apply();
};

$scope.saveIssue = function(issue) {
  console.log(issue);
  if (issue['issue'] == null && issue['key'] == null) {
    return
  }

  else if (issue['issue'] == "" && issue['key'] != null) {
  	SWBrijj.proc('ownership.delete_issue', issue['key']).then(function(data) {
  		angular.forEach($scope.issues, function(oneissue) {
  			if (oneissue['key'] == issue['key']) {
  				var index = $scope.issues.indexOf(oneissue);
				  $scope.issues.splice(index, 1);
          var indexed = $scope.issuekeys.indexOf(oneissue.key);
          $scope.issuekeys.splice(indexed, 1);
  			}
      });
      angular.forEach($scope.rows, function(row) {
        if (issue.key in row) {
          delete row[issue.key];
        }
        if (row["name"] == issue.key+ " (unissued)") {
          var index = $scope.rows.indexOf(row);
          $scope.rows.splice(index, 1);
        }
      });
  	});
  	$scope.$apply();
    return
  }

  else {

    if (issue['key'] != null) {
      var dateconvert = new Date(issue['date']);
      var d1 = dateconvert.toUTCString();
      console.log(d1);
      if (issue['partpref'] != null) {
          var partpref = $scope.strToBool(issue['partpref']);
        };
        if (issue['liquidpref'] != null) {
          var liquidpref = $scope.strToBool(issue['liquidpref']);
        };

      if (issue['vestingbegins'] == undefined) {
        var vestcliffdate = null
      }

      else {
        var vestcliffdate = (issue['vestingbegins']).toUTCString();
      }

      SWBrijj.proc('ownership.update_issue', issue['key'], d1, issue['issue'], parseFloat(issue['premoney']), parseFloat(issue['postmoney']), parseFloat(issue['ppshare']), parseFloat(issue['totalauth']), partpref, liquidpref, issue['optundersec'], parseFloat(issue['price']), parseFloat(issue['terms']), vestcliffdate, parseFloat(issue['vestcliff']), issue['vestfreq'], issue['debtundersec'], parseFloat(issue['interestrate']), parseFloat(issue['valcap']), parseFloat(issue['discount']), parseFloat(issue['term'])).then(function(data) { 
        console.log("saved");
        var oldissue = issue['key'];
        if (issue['issue'] != issue.key) {
          angular.forEach($scope.rows, function(row) {
          	row[issue['issue']] = row[issue.key];
            delete row[issue.key];
          });
        };
        var keepgoing = true;
        var deleterow = -1;
        var issuename = String(issue.issue)
        var leftovers = calculateauth.adding(issue.totalauth, issue, $scope.rows);
        var shares = {"u":leftovers};
        angular.forEach($scope.rows, function(row) {
          if (keepgoing) {
            if (row.name == oldissue+" (unissued)") {
              keepgoing = false;
              if (issue.totalauth > 0 || issue.totalauth < 0) {
                console.log("we're here");
                console.log(row);
                console.log(issue.issue);
                row[issuename] = shares;
                row['name'] = issue.issue + " (unissued)";
                console.log(row);
              }
              else {
                deleterow = $scope.rows.indexOf(row);
              }
            }
          }
        });
        if (keepgoing != false) {
          if (parseInt(leftovers) % 1 == 0) {
            $scope.rows.push({"name":issuename+" (unissued)", "editable":0, "nameeditable":0});
            $scope.rows[($scope.rows.length)-1][issuename] = shares;
          };
        }
        if (deleterow > -1) {
          $scope.rows.splice(deleterow, 1);
        };
        angular.forEach($scope.trans, function(tran) {
          if (tran.issue == issue.key) {
            tran.issue = issue['issue'];
          }
        });
        var index = $scope.issuekeys.indexOf(issue.key);
        $scope.issuekeys[index] = issue['issue'];
        issue.key=issue['issue'];
        $scope.$apply();
      	});
    } 

    else {
      var d1 = (Date.today()).toUTCString();
      var expire = null;
      SWBrijj.proc('ownership.create_issue', d1, expire, issue['issue'], parseFloat(issue['price'])).then(function(data) { 
        issue.key=issue['issue'];
        $scope.issues.push({name:""})
        $scope.issuekeys.push(issue.key);
        angular.forEach($scope.rows, function(row) {
          row[issue.key] = {"u":null, "a":null};
        });
        $scope.$apply();
      });	
    }
  }
};

$scope.tranChangeU = function(value) {
  if ($scope.activeTran.length < 2) {
  $scope.activeTran[0]['units'] = value;
  };
};

$scope.tranChangeA = function(value) {
  if ($scope.activeTran.length < 2) {
  $scope.activeTran[0]['amount'] = value;
  };
};

$scope.getActiveInvestor = function(investor) {
  $scope.sideBar=3;
  console.log(investor);
  if (investor.name == "") {
    var values = {"name":"", "editable":"0"}
    angular.forEach($scope.issuekeys, function(key) {
      values[key] = {"u":null, "a":null};
    });
    console.log(values);
    $scope.rows.push(values);
  }
  $scope.activeInvestorName = investor.name;
  $scope.$apply();
};

$scope.nameChangeLR = function(investor) {
  $scope.activeInvestorName = investor.name;
  if ((investor.name).length > 0) {
    angular.forEach($scope.rows, function(row) {
      if (row.name == investor.name) {
        row.editable = "yes";
      }
    });
  }
  else {
    angular.forEach($scope.rows, function(row) {
      if (row.name == investor.name) {
        row.editable = "0";
      }
    });
  }
};

$scope.nameChangeRL = function(investor) {
  $scope.activeInvestorName = investor.name;
};

$scope.updateRow = function(investor) {
  console.log(investor);
  if (investor.name == "") {
    var index = $scope.rows.indexOf(investor);
    $scope.rows.splice(index, 1);
    return
  }
  angular.forEach($scope.rows, function(row) {
    if(investor.name == row.name && investor['$$hashKey'] != row['$$hashKey']) {
      investor.name = investor.name + " (1)";
    };
  });
  if (investor.name != investor.namekey) {
    var index = $scope.rows.indexOf(investor);
    angular.forEach($scope.trans, function(tran) { 
      if (tran.investor == investor.namekey) {
        tran.investor = investor.name;
        $scope.saveTran(tran);
      };
  });
  if (investor.name) {
    $scope.rows[index].namekey = investor.name
    };
  }
  $scope.$apply();
};

$scope.createTran = function() {
  var newTran = {}
  newTran = {"new":"yes", "investor":$scope.activeInvestor, "investorkey":$scope.activeInvestor, "company":$scope.company, "date":(Date.today()), "datekey":(Date.today()), "issue":($scope.activeIssue), "units":null, "paid":null, "key":"undefined"};
	$scope.trans.push(newTran);
  $scope.activeTran.push(newTran);
}

$scope.deleteTran = function(tran) {
    var d1 = tran['date'].toUTCString();
    SWBrijj.proc('ownership.delete_transaction', tran['investor'], tran['issue'], d1).then(function(data) { 
      var index = $scope.trans.indexOf(tran);
      $scope.trans.splice(index, 1);
      angular.forEach($scope.rows, function(row) {
        if (row.name === tran['investor']) {
          row[tran['issue']] = (parseInt(row[tran['issue']]) - parseInt(tran['units']))
          row[tran['issue']] = {"u":null, "a":null};
        };
      });
      $scope.$apply();
  });
}

$scope.manualdeleteTran = function(tran) {
    var d1 = tran['date'].toUTCString();
    SWBrijj.proc('ownership.delete_transaction', tran['investor'], tran['issue'], d1).then(function(data) { 
      var index = $scope.trans.indexOf(tran);
      $scope.trans.splice(index, 1);
      var index = $scope.activeTran.indexOf(tran);
      $scope.activeTran.splice(index, 1);
      angular.forEach($scope.rows, function(row) { 
        if (row.name === tran['investor']) {
          row[tran['issue']] = (parseInt(row[tran['issue']]) - parseInt(tran['units']))
          row[tran['issue']] = {"u":null, "a":null};
        };
      });
      $scope.$apply();
  });
}

$scope.saveTran = function(transaction) {
  var savingActive = $scope.activeTran
  console.log(transaction);
  if (transaction == undefined) {
    return
  }
  console.log(parseInt(transaction['amount']) % 1);
  console.log(parseInt(transaction['units']) % 1);
  if (isNaN(parseInt(transaction['units']) % 1) && isNaN(parseInt(transaction['amount']) % 1)) {
    $scope.deleteTran(transaction);
    return
  }
  else if (transaction['issue'] == undefined || (parseInt(transaction['units']) % 1 != 0 && parseInt(transaction['amount'] % 1 != 0))) {
    console.log("not saving");
    return;
  }
  else {
        console.log("transaction saving");
        var d1 = transaction['date'].toUTCString();
        if (transaction['key'] == undefined) {
          transaction['key'] = "undefined";
        };
        if (parseFloat(transaction['amount']) % 1 != 0) {
        };
        if (transaction['partpref'] != null) {
          var partpref = $scope.strToBool(transaction['partpref']);
        };
        if (transaction['liquidpref'] != null) {
          console.log("here");
          var liquidpref = $scope.strToBool(transaction['liquidpref']);
        };
        if (transaction['vestingbegins'] == undefined) {
          var vestcliffdate = null
        }

        else {
          var vestcliffdate = (transaction['vestingbegins']).toUTCString();
        }

        SWBrijj.proc('ownership.update_transaction', transaction['investor'], transaction['investorkey'], transaction['key'], transaction['issue'], parseFloat(transaction['units']), transaction['datekey'], d1, parseFloat(transaction['amount']), parseFloat(transaction['premoney']), parseFloat(transaction['postmoney']), parseFloat(transaction['ppshare']), parseFloat(transaction['totalauth']), partpref, liquidpref, transaction['optundersec'], parseFloat(transaction['price']), parseFloat(transaction['terms']), vestcliffdate, parseFloat(transaction['vestcliff']), transaction['vestfreq'], transaction['debtundersec'], parseFloat(transaction['interestrate']), parseFloat(transaction['valcap']), parseFloat(transaction['discount']), parseFloat(transaction['term'])).then(function(data) { 
          console.log(data);
          var tempunits = 0;
          var tempamount = 0;
          angular.forEach($scope.rows, function(row) {
          	angular.forEach(savingActive, function(tran) {
      			if (row.name == tran.investor) {
          				if (tran.issue == transaction.issue) {
                    tran.key = tran.issue;
                    transaction.datekey = d1
          					tempunits = tempunits + parseInt(tran.units);
                    tempamount = tempamount + parseInt(tran.amount);
          					row[tran.issue]['u'] = tempunits;
                    row[tran.issue]['a'] = tempamount;
          				}
          		}
              if (row.name == tran.issue+" (unissued)") {
                angular.forEach($scope.issues, function(issue) {
                  if (issue.issue == tran.issue) {
                    var leftovers = calculateauth.adding(issue.totalauth, issue, $scope.rows);
                    var shares = {"u":leftovers};
                    row[issue.issue] = shares;
                  }
                });
              }
          	});
          });
          $scope.$apply();
        });
      };
};

  $scope.strToBool = function(string){
    switch(String(string).toLowerCase()){
      case "true": case "yes": case "1": return true;
      case "false": case "no": case "0": case null: return false;
      default: return Boolean(string);
    }
  };


};