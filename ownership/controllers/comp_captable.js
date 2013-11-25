

var captableController = function ($scope, $rootScope, $location, $parse, SWBrijj, calculate, switchval, sorting, navState) {

    if (navState.role == 'investor') {
        $location.path('/investor-captable');
        return;
    }
    var company = navState.company;
    $scope.currentCompany = company;

    // Set the view toggles to their defaults
    $scope.radioModel = "Edit";
    $scope.maintoggle = true;
    $scope.dilutionSwitch = true;
    $scope.captablestate = 0;

    // Tour options
    $scope.tourshow = false;
    $scope.tourstate = 0;
    $scope.tourmessages = {};
    $scope.tourmessages.intro = "Hover over these icons to reveal helpful info about your table";
    $scope.tourmessages.share = "When you’re finished, share your cap table with others";
    $scope.tourmessages.view = "When you’re not editing, click here for the best view of your data";
    $scope.tourmessages.sidebar = "Additional details for securites and transactions are tucked away here";
    $scope.tourmessages.issuecog = "Additional details for securites and transactions are tucked away here";

    // Variables for the select boxes to limit the selections to the available database types
    $scope.issuetypes = [];
    $scope.freqtypes = [];
    $scope.tf = ["yes", "no"];
    $scope.liquidpref = ['None','1X','2X', '3X'];


    $scope.extraPeople = [
        {"email": ""}
    ];

    // Database calls to get the available issuetypes and frequency types (i.e. monthly, weekly etc.)
    SWBrijj.procm('ownership.get_transaction_types').then(function (results) {
        angular.forEach(results, function (result) {
            $scope.issuetypes.push(result['get_transaction_types']);
        });
    });
    SWBrijj.procm('ownership.get_freqtypes').then(function (results) {
        angular.forEach(results, function (result) {
            $scope.freqtypes.push(result['get_freqtypes']);
        });
    });


    // Empty variables for issues
    $scope.issuekeys = [];
    $scope.issues = [];

    // Sorting variables
    $scope.issueSort = 'date';
    $scope.rowSort = '-name';

    // Empty variables for the rows and transactions
    $scope.rows = [];
    $scope.uniquerows = [];
    $scope.activeTran = [];

    // Initialize a few visible variables
    $scope.investorOrder = "name";
    $scope.sideToggleName = "Hide";
    $('.tour-box').affix({});

    // Get the company's Issues
    SWBrijj.tblm('ownership.company_issue').then(function (data) {
        $scope.issues = data;

        // Get the company's rows
        SWBrijj.tblm('ownership.company_row_names').then(function (names) {
            // Get the company's Transactions
            SWBrijj.tblm('ownership.company_transaction').then(function (trans) {
                $scope.trans = trans;
                if (Object.keys(trans).length == 0 && Modernizr.testProp('pointerEvents')) {
                    $scope.maintoggle = false;
                    $scope.radioModel = "View";
                    $scope.tourshow = true;
                    $scope.sideToggle = true;
                    $scope.tourUp();
                }

                // Get the company's Grants
                SWBrijj.tblm('ownership.company_grants').then(function (grants) {
                    $scope.grants = grants;


                    for (var i = 0, l = $scope.issues.length; i < l; i++) {
                        $scope.issues[i].key = $scope.issues[i].issue;
                        $scope.issuekeys.push($scope.issues[i].key);
                    }

                    angular.forEach($scope.issues, function(issue) {
                        var offset = issue.date.getTimezoneOffset();
                        issue.date = issue.date.addMinutes(offset);
                        if (issue.vestingbegins) {
                            issue.vestingbegins = issue.vestingbegins.addMinutes(offset);
                        }
                    });

                    // Uses the grants to update the transactions with forfeited values
                    // Eliminates the need for further reference to forfeit grants
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
                                if (grant.action == "exercised") {
                                    if (tran.exercised) {
                                        tran.exercised = tran.exercised + grant.unit;
                                    }
                                    else {
                                        tran.exercised = grant.unit;
                                    }
                                }
                            }
                        });
                    });

                    angular.forEach(names, function(name) {
                        $scope.rows.push({"name": name.name, "namekey": name.name, "editable": "yes"});
                    });

                    // Various extra key fields given to the transactions to allow for reverting at a later point
                    for (var i = 0, l = $scope.trans.length; i < l; i++) {
                        $scope.trans[i].key = $scope.trans[i].issue;
                        $scope.trans[i].unitskey = $scope.trans[i].units;
                        $scope.trans[i].paidkey = $scope.trans[i].amount;
                        var offset = $scope.trans[i].date.getTimezoneOffset();
                        $scope.trans[i].date = $scope.trans[i].date.addMinutes(offset);
                        $scope.trans[i].datekey = $scope.trans[i]['date'].toUTCString();
                        if ($scope.trans[i].vestingbegins) {
                            $scope.trans[i].vestingbegins = $scope.trans[i].vestingbegins.addMinutes(offset);
                        }
                        $scope.trans[i].investorkey = $scope.trans[i].investor;
                        if ($scope.uniquerows.indexOf($scope.trans[i].investor) == -1) {
                            $scope.uniquerows.push($scope.trans[i].investor);
                            angular.forEach($scope.rows, function(row) {
                                if (row.namekey == $scope.trans[i].investor) {
                                    row.email = $scope.trans[i].email;
                                    row.emailkey = $scope.trans[i].email;
                                }
                            });
                        }
                        // Transactions inherit the issue values that are uneditable for individual transactions
                        angular.forEach($scope.issues, function (issue) {
                            if ($scope.trans[i].issue == issue.issue) {
                                $scope.trans[i].totalauth = issue.totalauth;
                                $scope.trans[i].premoney = issue.premoney;
                                $scope.trans[i].postmoney = issue.postmoney;
                            }
                        });
                    }

                    // Generate the rows from the transactions
                    // u represents units throughout, a price
                    angular.forEach($scope.trans, function (tran) {
                        angular.forEach($scope.rows, function (row) {
                            if (row.name == tran.investor) {
                                if (tran.issue in row) {
                                    row[tran.issue]["u"] = calculate.sum(row[tran.issue]["u"], tran.units);
                                    row[tran.issue]["a"] = calculate.sum(row[tran.issue]["a"], tran.amount);
                                    row[tran.issue]["ukey"] = row[tran.issue]["u"];
                                    row[tran.issue]["akey"] = row[tran.issue]["a"];
                                    if (!isNaN(parseFloat(tran.forfeited))) {
                                        row[tran.issue]["u"] = calculate.sum(row[tran.issue]["u"], (-tran.forfeited));
                                        row[tran.issue]["ukey"] = row[tran.issue]["u"];
                                    }
                                    if (!isNaN(parseFloat(tran.exercised))) {
                                        row[tran.issue]["exercised"] = calculate.sum(row[tran.issue]["exercised"], (tran.exercised));
                                    }
                                }
                                else {
                                    row[tran.issue] = {};
                                    row[tran.issue]["u"] = tran.units;
                                    row[tran.issue]["a"] = tran.amount;
                                    row[tran.issue]["ukey"] = tran.units;
                                    row[tran.issue]["akey"] = tran.amount;
                                    row[tran.issue]["state"] = false;
                                    if (!isNaN(parseFloat(tran.forfeited))) {
                                        row[tran.issue]["u"] = calculate.sum(row[tran.issue]["u"], (-tran.forfeited));
                                        row[tran.issue]["ukey"] = row[tran.issue]["u"];
                                    }
                                    if (!isNaN(parseFloat(tran.exercised))) {
                                        row[tran.issue]["exercised"] = calculate.sum(row[tran.issue]["exercised"], (tran.exercised));
                                    }
                                }
                            }
                            else {
                                if (tran.issue in row) {
                                }
                                else {
                                    row[tran.issue] = {"u": null, "a": null, "ukey": null, "akey": null};
                                }
                            }
                        });
                    });

                    // Get the company's Paripassu's on issues
                    SWBrijj.tblm('ownership.company_paripassu').then(function (links) {
                        var links = links;
                        angular.forEach($scope.issues, function(issue) {
                            issue.paripassu = [];
                            angular.forEach(links, function(pari) {
                                if (pari.issue == issue.issue) {
                                    issue.paripassu.push(pari);
                                }
                            });
                            if (issue.paripassu.length == 0) {
                                issue.paripassu.push({"company":issue.company, "issue": issue.issue, "pariwith": null});
                            }
                        })
                    });

                    SWBrijj.tblm('ownership.company_conversion').then(function (convert) {
                        SWBrijj.tblm('ownership.company_transfer').then(function (transfer) {
                            angular.forEach($scope.trans, function (tran) {
                                tran.convert = [];
                                angular.forEach(convert, function(con) {
                                    if (con.tranto == tran.tran_id) {
                                        var offset = con.date.getTimezoneOffset();
                                        con.date = con.date.addMinutes(offset);
                                        if (con.method == "Split") {
                                            con.split = new Fraction(con.split);
                                        }
                                        tran.convert.push(con);
                                    }
                                });

                                angular.forEach(transfer, function(transf) {
                                    var offset = transf.date.getTimezoneOffset();
                                    transf.date = transf.date.addMinutes(offset);
                                    if (transf.tranto == tran.tran_id) {
                                        var final = angular.copy(transf);
                                        final.direction = "To";
                                        tran.convert.push(final);
                                    }
                                    else if (transf.tranfrom == tran.tran_id) {
                                        var final = angular.copy(transf);
                                        final.direction = "From";
                                        tran.convert.push(final);
                                    }
                                });
                            });
                        });
                    });




                    // Debt calculation for any rows with paid but no shares
                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issues, function (issue) {
                            if (row[issue.issue] != undefined) {
                                if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u']))) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                                    row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                                }
                            }
                        });
                    });

                    // Generate the unissued rows (the difference between total authorised and actually authorised)
                    angular.forEach($scope.issues, function (issue) {
                        $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(issue.issue));
                    });


                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issuekeys, function (issuekey) {
                            if (issuekey in row) {
                            }
                            else {
                                row[issuekey] = {"u": null, "a": null, "ukey": null, "akey": null};
                            }
                        });
                    });

                    angular.forEach($scope.rows, function(row) {
                        row.startpercent = calculate.sharePercentage(row, $scope.rows, $scope.issuekeys, shareSum(row), totalShares($scope.rows))
                    });


                    // Sort the columns before finally showing them
                    // Issues are sorted by date, rows by ownership within each issue
                    $scope.issues.sort(sorting.issuedate);
                    $scope.issuekeys = sorting.issuekeys($scope.issuekeys, $scope.issues);
                    $scope.rows.sort(sorting.basicrow());

                    do
                    {
                        var values = {"name": "", "editable": "0"};
                        angular.forEach($scope.issuekeys, function (key) {
                            values[key] = {"u": null, "a": null, "ukey": null, "akey": null};
                        });
                        $scope.rows.push(values);
                    }
                    while ($scope.rows.length < 5);

                    //Calculate the total vested for each row
                    $scope.rows = calculate.detailedvested($scope.rows, $scope.trans);

                    // Add extra blank issue, which will create a new one when clicked. Silly future date so that
                    // the issue always appears on the rightmost side of the table
                    $scope.issues.push({"name": "", "date": new Date(2100, 1, 1)});

                    $scope.finishedsorting = true;
                    if ($scope.radioModel == "Edit") {
                        //Placeholder for where the tour start function will be
                    }

                    for (var i=0; i < $scope.trans.length; i++) {
                        $scope.$watch('trans['+i+']', function(newval, oldval) {
                            $scope.transaction_watch(newval, oldval);
                        }, true);
                    }

                    for (var i=0; i < $scope.issues.length; i++) {
                        $scope.$watch('issues['+i+']', function(newval, oldval) {
                            $scope.issue_watch(newval, oldval);
                        }, true);
                    }

                    var earliestedit = new Date.today().addDays(1);
                    var duplicate = earliestedit;
                    angular.forEach($scope.issues, function(issue) {
                        if (issue.created) {
                            if (Date.compare(earliestedit, issue.created) > -1) {
                                earliestedit = issue.created;
                            }
                        }
                    });
                    if (earliestedit != duplicate) {
                        Intercom('update', {company : {'captablestart_at':parseInt(Date.parse(earliestedit).getTime()/1000)}});
                    }

                });
            });
        });
    });



    // This call is only here for Intercom (Data is not otherwise available on the page)
    SWBrijj.tblm("ownership.clean_company_access").then(function (data) {
        Intercom('update', {company : {'captable_shares':data.length}});
    });


    $scope.findValue = function (row, header) {
        angular.forEach($scope.rows, function (picked) {
            if (picked == row) {
                return $scope.rows[header];
            }
        });
    };

    $scope.getActiveTransaction = function (currenttran, currentcolumn) {
        $scope.sidebarstart = angular.copy($scope.sideBar);
        $scope.oldActive = angular.copy($scope.activeTran);
        if ($scope.toggleView()) {
            $scope.sideBar = 4;
        }
        else {
            $scope.sideBar = 2;
        }
        $scope.activeTran = [];
        $scope.activeIssue = currentcolumn;
        $scope.activeInvestor = currenttran;
        // Get the all the issues that aren't the current issue for the drop downs
        var allowablekeys = angular.copy($scope.issuekeys);
        var index = allowablekeys.indexOf(currentcolumn);
        allowablekeys.splice(index, 1);
        $scope.allowKeys = allowablekeys;

        angular.forEach($scope.rows, function (row) {
            row.state = false;
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue) {
                    if (row.name == currenttran && currentcolumn == issue.issue) {
                        row[currentcolumn].state = true;
                    }
                    else {
                        row[issue.issue].state = false;
                        issue.state = false;
                    }
                }
            });
        });

        var first = 0;
        angular.forEach($scope.trans, function (tran) {
            if (tran.investor == currenttran) {
                if (tran.issue == currentcolumn) {
                    if (first == 0) {
                        tran['active'] = true;
                        first = first + 1
                    }
                    if (String(tran['partpref']) == "true") {
                        tran.partpref = $scope.tf[0];
                    }
                    else if (String(tran['partpref']) == "false") {
                        tran.partpref = $scope.tf[1];
                    }
                    if (String(tran['dragalong']) == "true") {
                        tran.dragalong = $scope.tf[0];
                    }
                    else if (String(tran['dragalong']) == "false") {
                        tran.dragalong = $scope.tf[1];
                    }
                    if (String(tran['tagalong']) == "true") {
                        tran.tagalong = $scope.tf[0];
                    }
                    else if (String(tran['tagalong']) == "false") {
                        tran.tagalong = $scope.tf[1];
                    }
                    $scope.activeTran.push(tran);
                }
            }
        });
        if ($scope.activeTran.length < 1) {
            var anewTran = {};
            anewTran = {"active": true, "atype": 0, "new": "yes", "investor": $scope.activeInvestor, "investorkey": $scope.activeInvestor, "company": $scope.company, "date": (Date.today()), "datekey": (Date.today()), "issue": (currentcolumn), "units": null, "paid": null, "unitskey": null, "paidkey": null, "key": 'undefined', "convert": []};
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue == currentcolumn) {
                    anewTran = $scope.tranInherit(anewTran, issue);
                }
            });
            $scope.trans.push(anewTran);
            $scope.activeTran.push(anewTran);
        }
        if ($scope.oldActive[0] != $scope.activeTran[0]) {
            $scope.activeTran[0].go = false;
        }
    };

    $scope.getActiveIssue = function (issue) {

        if ($scope.toggleView()) {
            $scope.sideBar = 5;
        }
        else {
            $scope.sideBar = 1;
        }
        $scope.activeIssue = issue;
        $scope.issueRevert = angular.copy(issue);

        angular.forEach($scope.rows, function (row) {
            row.state = false;
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue) {
                    row[issue.issue].state = false;
                    issue.state = false;
                }
            });
        });

        issue.state = true;

        // Get the all the issues that aren't the current issue for the drop downs
        var allowablekeys = angular.copy($scope.issuekeys);
        var index = allowablekeys.indexOf(issue.issue);
        allowablekeys.splice(index, 1);
        $scope.allowKeys = allowablekeys;

        // Set Boolean Values for the Angularjs Select
        if (String($scope.activeIssue.partpref) == "true") {
            $scope.activeIssue.partpref = $scope.tf[0];
        }
        else if (String($scope.activeIssue.partpref) == "false") {
            $scope.activeIssue.partpref = $scope.tf[1];
        }
        if (String($scope.activeIssue.dragalong) == "true") {
            $scope.activeIssue.dragalong = $scope.tf[0];
        }
        else if (String($scope.activeIssue.dragalong) == "false") {
            $scope.activeIssue.dragalong = $scope.tf[1];
        }
        if (String($scope.activeIssue.tagalong) == "true") {
            $scope.activeIssue.tagalong = $scope.tf[0];
        }
        else if (String($scope.activeIssue.tagalong) == "false") {
            $scope.activeIssue.tagalong = $scope.tf[1];
        }
        if ($scope.activeIssue.date == "Mon Feb 01 2100 00:00:00 GMT-0500 (EST)") {
            $scope.activeIssue.date = (Date.today());
        }
        if ($scope.activeIssue.common) {
            $scope.commonshow = true;
        }
        else {
            var comtoggle = false;
            angular.forEach($scope.issues, function(iss) {
                comtoggle = iss.common || comtoggle ? true : false;
            });
            $scope.commonshow = comtoggle ? false : true;
        }
        // Set Freq Value for Angularjs Select
        var index = $scope.freqtypes.indexOf(issue.vestfreq);
        $scope.activeIssue.vestfreq = $scope.freqtypes[index];
    };

    $scope.saveIssueAssign = function (issue, field, i) {
        if (i) {
            issue[field] = i;
        }
        $scope.saveIssueCheck(issue, field)
    }

    $scope.saveIssueCheckDate = function (issue, field, evt) {
        //Fix the dates to take into account timezone differences
        if (evt) { // User is typing
            if (evt != 'blur')
                keyPressed = true;
            var dateString = angular.element(field + '#' + issue.$$hashKey).val();
            var charCode = (evt.which) ? evt.which : event.keyCode; // Get key
            if (charCode == 13 || (evt == 'blur' && keyPressed)) { // Enter key pressed or blurred
                var date = Date.parse(dateString);
                if (date) {
                    issue[field] = date;
                    var offset = issue[field].getTimezoneOffset();
                    issue[field] = issue[field].addMinutes(offset);
                    $scope.saveIssueCheck(issue, field);
                    keyPressed = false;
                }
            }
        } else { // User is using calendar
            if (issue[field] instanceof Date) {
                var offset = issue[field].getTimezoneOffset();
                issue[field] = issue[field].addMinutes(offset);
                $scope.saveIssueCheck(issue, field);
                keyPressed = false;
            }
        }
    };

    $scope.saveIssueCheck = function (issue, field) {
        var x = false;
        var testcopy = angular.copy(issue);
        if ($scope.issueModal == true) {
            return;
        }
        else {
            if (!angular.equals(testcopy, $scope.issueRevert)) {
                angular.forEach($scope.trans, function(tran) {
                    if (issue[field] != tran[field] && tran[field] != "" && issue['issue'] == tran['issue']) {
                        $scope.imodalUp(issue, field);
                        x = true;
                    }
                });
                if (x == false) {
                    $scope.saveIssue(issue, field);
                }
            }
            else {
                return;
            }
        }
    };

    /* Save Issue Function. Takes the issue and the item being changed so that the sub transactions can also be updated in just that field */
    $scope.saveIssue = function (issue, item) {
        if ((issue['issue'] == null || issue['issue'] == "") && issue['key'] == null) {
            return
        }

        else if (issue['issue'] == "" && issue['key'] != null) {
            $scope.dmodalUp(issue);
            return
        }

        else {

            if (issue['key'] != null) {
                var dateconvert = issue['date'];
                var d1 = dateconvert.toUTCString();
                var partpref = $scope.strToBool(issue['partpref']);
                var dragalong = $scope.strToBool(issue['dragalong']);
                var tagalong = $scope.strToBool(issue['tagalong']);
                var common = $scope.strToBool(issue['common']);

                if (issue['vestingbegins'] == undefined) {
                    var vestcliffdate = null
                }
                else {
                    var vestcliffdate = issue['vestingbegins']
                }
                SWBrijj.proc('ownership.update_issue', issue['key'], issue['type'], d1, issue['issue'], parseFloat(issue['premoney']), parseFloat(issue['postmoney']), parseFloat(issue['ppshare']), parseFloat(issue['totalauth']), partpref, issue.liquidpref, issue['optundersec'], parseFloat(issue['price']), parseFloat(issue['terms']), vestcliffdate, parseFloat(issue['vestcliff']), issue['vestfreq'], issue['debtundersec'], parseFloat(issue['interestrate']), issue['interestratefreq'], parseFloat(issue['valcap']), parseFloat(issue['discount']), parseFloat(issue['term']), dragalong, tagalong, common).then(function (data) {
                    $scope.lastsaved = Date.now();
                    var oldissue = issue['key'];
                    var index = -1;

                    // Fires only when you change the issue name to update the rows
                    // Removes unissued rows with the old name, new named ones get added further down
                    if (issue['issue'] != issue.key) {
                        angular.forEach($scope.rows, function (row) {
                            if (row.name == issue['key'] + " (unissued)" && index == -1) {
                                index = $scope.rows.indexOf(row);
                            }
                            row[issue['issue']] = row[issue.key];
                            delete row[issue.key];
                        });
                        if (index != -1) {
                            $scope.rows.splice(index, 1);
                        }
                    }

                    angular.forEach($scope.issues, function (x) {
                        $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
                    });

                    $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(issue.issue));

                    // Sorts out updating transactions if changes in issues need to be passed down
                    angular.forEach($scope.trans, function (tran) {
                        if (tran.issue == issue.key) {
                            tran[item] = issue[item];
                            if (item == "issue" && tran["optundersec"] && tran["optundersec"] == issue.key) {
                                tran.optundersec = issue[item];
                            }
                            else if (item == "issue" && tran["debtundersec"] && tran["debtundersec"] == issue.key) {
                                tran.debtundersec = issue[item];
                            }
                            if (tran.tran_id != undefined) {
                                $scope.saveTran(tran);
                            }
                        }
                    });

                    // In the case where the issue is changed and there are other issues that use it as the underlying
                    if (item == "issue") {
                        angular.forEach($scope.issues, function (keyissue) {
                            if (item == "issue" && keyissue["optundersec"] && keyissue["optundersec"] == issue.key) {
                                keyissue.optundersec = issue[item];
                                $scope.saveIssue(keyissue, 'optundersec');
                            }
                            else if (item == "issue" && keyissue["debtundersec"] && keyissue["debtundersec"] == issue.key) {
                                keyissue.debtundersec = issue[item];
                                $scope.saveIssue(keyissue, 'debtundersec');
                            }
                        });
                    }


                    // Recalculate the debt percentages
                    angular.forEach($scope.rows, function (row) {
                        if (row[issue.issue] != undefined) {
                            if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u']))) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                                row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                            }
                        }
                    });

                    // Make sure we have a clean slate for everyone (including any new unissued rows
                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issuekeys, function (issuekey) {
                            if (issuekey in row) {
                            }
                            else {
                                row[issuekey] = {"u": null, "a": null, "ukey": null, "akey": null};
                            }
                        });
                    });

                    $scope.issueRevert = angular.copy(issue);

                    //Calculate the total vested for each row
                    $scope.rows = calculate.detailedvested($scope.rows, $scope.trans);

                    var index = $scope.issuekeys.indexOf(issue.key);
                    $scope.issuekeys[index] = issue.issue;
                    issue.key = issue.issue;
                    $scope.hideTour = true;
                });
            }

            else {
                var d1 = (Date.today()).toUTCString();
                var expire = null;
                SWBrijj.proc('ownership.create_issue', d1, expire, issue['issue'], parseFloat(issue['price'])).then(function (data) {
                    $scope.lastsaved = Date.now();
                    issue.key = issue['issue'];
                    $scope.issues.push({name: "", "date": new Date(2100, 1, 1)});
                    $scope.issuekeys.push(issue.key);
                    angular.forEach($scope.rows, function (row) {
                        row[issue.key] = {"u": null, "a": null};
                    });
                    for (var i=0; i < $scope.issues.length; i++) {
                        if ($scope.issues[i] == issue) {
                            $scope.$watch('issues['+i+']', function(newval, oldval) {
                                $scope.issue_watch(newval, oldval);
                            }, true);
                        }
                    }

                    var allowablekeys = angular.copy($scope.issuekeys);
                    var index = allowablekeys.indexOf(issue.issue);
                    allowablekeys.splice(index, 1);
                    $scope.allowKeys = allowablekeys;
                    $scope.hideTour = true;
                });
            }
        }
    };

    $scope.deleteIssueButton = function (activeIssue) {
        $scope.dmodalUp(activeIssue);
    };

    $scope.deleteIssue = function (issue) {
        SWBrijj.proc('ownership.delete_issue', issue['key']).then(function (data) {
            $scope.lastsaved = Date.now();
            angular.forEach($scope.issues, function (oneissue) {
                if (oneissue['key'] == issue['key']) {
                    var index = $scope.issues.indexOf(oneissue);
                    $scope.issues.splice(index, 1);
                    var indexed = $scope.issuekeys.indexOf(oneissue.key);
                    $scope.issuekeys.splice(indexed, 1);
                }
            });
            angular.forEach($scope.rows, function (row) {
                if (issue.key in row) {
                    delete row[issue.key];
                }
                if (row["name"] == issue.key + " (unissued)") {
                    var index = $scope.rows.indexOf(row);
                    $scope.rows.splice(index, 1);
                }
            });
            $scope.sideBar = "x";
        });
    };

    $scope.revertIssue = function (issue) {
        angular.forEach($scope.issues, function (x) {
            if (x.key == issue.key) {
                x.issue = issue.key;
            }
        });
    };

    $scope.saveIssuePari = function (pari, item, items) {
        var allpari = "";
        var index;
        angular.forEach(items, function(picked) {
            if (picked.$$hashKey == item.$$hashKey) {
                picked.pariwith = pari;
            }
            if (picked.pariwith == "") {
                index = items.indexOf(picked);
            } else {
                allpari = allpari + picked.pariwith + ",";
            }
        });
        if (index) {
            items.splice(index, 1);
        }
        SWBrijj.proc('ownership.update_paris', item.company, item.issue, allpari.substring(0, allpari.length-1)).then(function (data) {
            $scope.lastsaved = Date.now();
        });
    };

    $scope.addIssuePari = function(items) {
        items.push({"company": items[0].company, "issue": items[0].issue, "pariwith": null});
    };

    $scope.availableKeys = function(issues, paripassu) {
        var list = [];
        var used = [];
        list.push("");
        angular.forEach(paripassu, function(pari) {
            used.push(pari.pariwith);
        })
        angular.forEach(issues, function(issue) {
            if (used.indexOf(issue) == -1) {
                list.push(issue)
            }
        });
        return list
    };

    $scope.showPari = function(list) {
        return (list.length > 0)
    };

    $scope.toggleCommon = function(issue) {
        issue.common = issue.common && issue.type == 'Equity' ? false : true;
        $scope.saveIssue(issue);
    };

    $scope.tranChangeU = function (value, issue) {
        angular.forEach($scope.issues, function (x) {
            $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
        });

        $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(issue));
        if ($scope.activeTran.length < 2) {
            $scope.activeTran[0]['units'] = value;
        }
    };

    $scope.tranChangeA = function (value) {
        if ($scope.activeTran.length < 2) {
            $scope.activeTran[0]['amount'] = value;
        }
    };

    $scope.getActiveInvestor = function (investor) {
        $scope.sideBar = 3;

        angular.forEach($scope.rows, function (row) {
            row.state = false;
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue) {
                    if (row[issue.issue]) {
                        row[issue.issue].state = false;
                    }
                    issue.state = false;
                }
            });
        });

        investor.state = true;
        var rowindex = $scope.rows.indexOf(investor);

        if (investor.name == "" && rowindex >= 4) {
            var values = {"name": "", "editable": "0"};
            angular.forEach($scope.issuekeys, function (key) {
                values[key] = {"u": null, "a": null, "ukey": null, "akey": null};
            });
            $scope.rows.push(values);
        }
        $scope.activeInvestorName = investor.name;
        $scope.activeInvestorEmail = investor.email;
        $scope.activeInvestorNameKey = angular.copy(investor.name);
    };

    $scope.nameChangeLR = function (investor) {
        $scope.activeInvestorName = investor.name;
        if ((investor.name).length > 0) {
            angular.forEach($scope.rows, function (row) {
                if (row.name == investor.name) {
                    row.editable = "yes";
                }
            });
        }
        else {
            angular.forEach($scope.rows, function (row) {
                if (row.name == investor.name) {
                    row.editable = "0";
                }
            });
        }
    };

    $scope.nameChangeRL = function (investor) {
        $scope.activeInvestorName = investor.name;
    };

    $scope.deletePersonButton = function (name) {
        angular.forEach($scope.rows, function (row) {
            if (row.name == name) {
                $scope.rmodalUp(row);
            }
        })
    };

    // Creates a new blank transaction with today's date
    $scope.createTrantab = function () {
        if ($scope.activeTran[0] && $scope.activeTran[0].go) {
            var inIssue = $scope.activeTran[0].issue
            var newTran = {};
            newTran = {"new": "yes", "atype": 0, "investor": $scope.activeInvestor, "investorkey": $scope.activeInvestor, "company": $scope.company, "date": (Date.today()), "datekey": (Date.today()), "issue": (inIssue), "units": null, "paid": null, "unitskey": null, "paidkey": null, "key": "undefined", "convert": []};
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue == inIssue) {
                    newTran = $scope.tranInherit(newTran, issue);
                }
            });
            $scope.trans.push(newTran);
            $scope.activeTran.push(newTran);
            for (var i = 0; i < $scope.activeTran.length; i++) {
                if (i + 1 == $scope.activeTran.length) {
                    $scope.activeTran[i].active = true;
                }
                else {
                    $scope.activeTran[i].active = false;
                }
            }
        }
        $scope.activeTran[0].go = true;
    };

    $scope.revertTran = function (transaction) {
        angular.forEach($scope.trans, function(tran) {
            if (tran.tran_id == transaction.tran_id) {
                tran.units = tran.unitskey;
                tran.amount = tran.paidkey;
                $scope.saveTran(tran);
            }
        });
    };

    // Function for when the delete transaction button is pressed in the right sidebar
    $scope.manualdeleteTran = function (tran) {
        var d1 = tran['date'].toUTCString();
        SWBrijj.proc('ownership.delete_transaction', tran['tran_id']).then(function (data) {
            $scope.lastsaved = Date.now();
            var index = $scope.trans.indexOf(tran);
            $scope.trans.splice(index, 1);
            var index = $scope.activeTran.indexOf(tran);
            $scope.activeTran.splice(index, 1);
            angular.forEach($scope.rows, function (row) {
                if (row.name === tran['investor']) {
                    if (!isNaN(tran.units)) {
                        row[tran.issue]['u'] = row[tran.issue]['u'] - tran.units;
                        row[tran.issue]['ukey'] = row[tran.issue]['u']
                        if (row[tran.issue]['u'] == 0) {
                            row[tran.issue]['u'] = null;
                            row[tran.issue]['ukey'] = null;
                        }
                    }
                    if (!isNaN(tran.amount)) {
                        row[tran.issue]['a'] = row[tran.issue]['a'] - tran.amount;
                        row[tran.issue]['akey'] = row[tran.issue]['a']
                        if (row[tran.issue]['a'] == 0) {
                            row[tran.issue]['a'] = null;
                            row[tran.issue]['akey'] = null;
                        }
                    }
                }
            });
            angular.forEach($scope.issues, function (x) {
                $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
            });

            $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(tran.issue));
        });
    };

    $scope.updateRow = function (investor) {
        if (investor.name == "" && investor.namekey != undefined) {
            $scope.rmodalUp(investor);
            return
        }

        var rowindex = $scope.rows.indexOf(investor);

        if (investor.name == "" && rowindex >= 4) {
            var index = $scope.rows.indexOf(investor);
            $scope.rows.splice(index, 1);
            return
        }
        angular.forEach($scope.rows, function (row) {
            if (investor.name != "" && investor.name == row.name && investor['$$hashKey'] != row['$$hashKey']) {
                investor.name = investor.name + " (1)";
            }
        });
        if (investor.name != "" && investor.name != investor.namekey) {
            investor.namekey = investor.namekey ? investor.namekey : "!!";
            SWBrijj.proc('ownership.update_row', investor.namekey, investor.name).then(function (data) {
                $scope.lastsaved = Date.now();
                var index = $scope.rows.indexOf(investor);
                angular.forEach($scope.trans, function (tran) {
                    if (tran.investor == investor.namekey) {
                        tran.investor = investor.name;
                    }
                });
                if (investor.name) {
                    $scope.rows[index].namekey = investor.name
                }
            });
        }
        $scope.$apply();
    };

    $scope.revertPerson = function (investor) {
        angular.forEach($scope.rows, function (row) {
            if (row.namekey == investor) {
                row.name = row.namekey;
                $scope.nameChangeLR(row)
            }
        });
    };

    $scope.deletePerson = function (investor) {
        $scope.sideBar = "x";
        SWBrijj.proc('ownership.delete_row', investor).then(function (data) {
            $scope.lastsaved = Date.now();
            angular.forEach($scope.trans, function (tran) {
                if (tran.investor == investor) {
                    var index = $scope.trans.indexOf(tran);
                    $scope.trans.splice(index, 1);
                    angular.forEach($scope.rows, function (row) {
                        if (row.name === tran['investor']) {
                            if (!isNaN(tran.units)) {
                                row[tran.issue]['u'] = row[tran.issue]['u'] - tran.units;
                                row[tran.issue]['ukey'] = row[tran.issue]['u']
                                if (row[tran.issue]['u'] == 0) {
                                    row[tran.issue]['u'] = null
                                    row[tran.issue]['ukey'] = null
                                }
                            }
                            if (!isNaN(tran.amount)) {
                                row[tran.issue]['a'] = row[tran.issue]['a'] - tran.amount;
                                row[tran.issue]['akey'] = row[tran.issue]['a']
                                if (row[tran.issue]['a'] == 0) {
                                    row[tran.issue]['a'] = null
                                    row[tran.issue]['akey'] = null
                                }
                            }
                        }
                    });

                    angular.forEach($scope.issues, function (x) {
                        $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
                    });

                    $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(tran.issue));
                }
            });

            angular.forEach($scope.rows, function (row) {
                if (row.namekey == investor) {
                    var index = $scope.rows.indexOf(row);
                    $scope.rows.splice(index, 1);
                    if ($scope.rows.length <= 5) {
                        var values = {"name": "", "editable": "0"};
                        angular.forEach($scope.issuekeys, function (key) {
                            values[key] = {"u": null, "a": null, "ukey": null, "akey": null};
                        });
                        $scope.rows.splice(index, 0, values);
                    }
                }
            });
        });
    };

    $scope.saveTranAssign = function (transaction, field, value) {
        if (value) {
            transaction[field] = value;
        }
        $scope.saveTran(transaction);
    };

    // Preformatting on the date to factor in the local timezone offset
    var keyPressed = false; // Needed because selecting a date in the calendar is considered a blur, so only save on blur if user has typed a key
    $scope.saveTranDate = function (transaction, field, evt) {
        if (evt) { // User is typing
            if (evt != 'blur')
                keyPressed = true;
            var dateString = angular.element(field + '#' + transaction.$$hashKey).val();
            var charCode = (evt.which) ? evt.which : event.keyCode; // Get key
            if (charCode == 13 || (evt == 'blur' && keyPressed)) { // Enter key pressed or blurred
                var date = Date.parse(dateString);
                if (date) {
                    transaction[field] = date;
                    var offset = transaction[field].getTimezoneOffset();
                    transaction[field] = transaction[field].addMinutes(offset);
                    keyPressed = false;
                    $scope.saveTran(transaction);
                }
            }
        } else { // User is using calendar
            //Fix the dates to take into account timezone differences.
            if (transaction[field] instanceof Date) {
                var offset = transaction[field].getTimezoneOffset();
                transaction[field] = transaction[field].addMinutes(offset);
                keyPressed = false;
                $scope.saveTran(transaction);
            }
        }
    };

    // Save transaction function
    $scope.saveTran = function (transaction) {
        //Triggers the multi modal if more than one transaction exists
        if (transaction.length > 1) {
            angular.forEach($scope.rows, function (row) {
                if (row.name == transaction[0].investor) {
                    // Deals with Changes in Units
                    if (!isNaN(parseFloat(row[transaction[0].issue]['u']))) {
                        if (parseFloat(row[transaction[0].issue]['u']) != parseFloat(row[transaction[0].issue]['ukey'])) {
                            var changed = (parseFloat(row[transaction[0].issue]['u']) - parseFloat(row[transaction[0].issue]['ukey']));
                            $scope.mmodalUp(changed, "u", transaction);
                            return
                        }
                    }
                    // Deals with changes in Price
                    if (!isNaN(parseFloat(row[transaction[0].issue]['a']))) {
                        if (parseFloat(row[transaction[0].issue]['a']) != parseFloat(row[transaction[0].issue]['akey'])) {
                            var changed = (parseFloat(row[transaction[0].issue]['a']) - parseFloat(row[transaction[0].issue]['akey']));
                            $scope.mmodalUp(changed, "a", transaction);
                            return
                        }
                    }
                }
            });
            // Reverts in the case where multitransaction rows are set to blank
            angular.forEach($scope.rows, function(row) {
                if (row.name == transaction[0].investor) {
                    row[transaction[0].issue]['u'] = row[transaction[0].issue]['ukey']
                    row[transaction[0].issue]['a'] = row[transaction[0].issue]['akey']
                }
            });
            return
        }
        // Moves on to the main saving process
        else {
            if (isArray(transaction)) {
                transaction = transaction[0];
            }
        }
        // Remove any commas added to the numbers
        if (transaction.units) {
            transaction.units = String(transaction.units).replace(/\,/g,'');
        }
        if (transaction.amount) {
            transaction.amount = String(transaction.amount).replace(/\,/g,'');
        }
        if (!(/^(\d+)*(\.\d+)*$/.test(transaction.units)) && transaction.units != null && transaction.units != "") {
            transaction.units = transaction.unitskey;
        };
        if (!(/^(\d+)*(\.\d+)*$/.test(transaction.amount)) && transaction.amount != null && transaction.amount != "") {
            transaction.amount = transaction.paidkey;
        };
        // Bail out if insufficient data has been added for the transaction
        if (transaction == undefined || isNaN(parseFloat(transaction.units)) && isNaN(parseFloat(transaction.amount)) && isNaN(parseInt(transaction.tran_id))) {
            return
        }
        // Delete the transaction if an existing transaction has had all its information removed
        if (isNaN(parseFloat(transaction.units)) && isNaN(parseFloat(transaction.amount)) && !isNaN(parseInt(transaction.tran_id))) {
            $scope.tranDeleteUp(transaction);
            return
        }
        // Not quite enough information to save
        else if (transaction['issue'] == undefined || (isNaN(parseFloat(transaction['units'])) && isNaN(parseFloat(transaction['amount'])))) {
            return
        }
        // We have enough info to begin the saving process
        else {
            if (transaction.type == "Option" && transaction.units < 0) {
                transaction.units = transaction.unitskey;
                $scope.$emit("notification:fail", "Cannot have a negative number of shares");
                return
            }
            else if (transaction.amount < 0) {
                transaction.amount = transaction.paidkey;
                $scope.$emit("notification:fail", "Cannot have a negative amount for options");
                return
            }
            else {
                var d1 = transaction['date'].toUTCString();
                if (transaction['tran_id'] == undefined) {
                    transaction['tran_id'] = '';
                }
                var partpref = $scope.strToBool(transaction['partpref']);
                var dragalong = $scope.strToBool(transaction['dragalong']);
                var tagalong = $scope.strToBool(transaction['tagalong']);
                var vestcliffdate = transaction['vestingbegins'] == undefined ? null : transaction['vestingbegins'];

                // Convert amount to a float but remove the NaNs if amount is undefined
                transaction['amount'] = parseFloat(transaction['amount']);
                if (isNaN(transaction['amount'])) {
                    transaction['amount'] = null;
                }
                transaction['units'] = parseFloat(transaction['units']);
                if (isNaN(transaction['units'])) {
                    transaction['units'] = null;
                }
                angular.forEach($scope.rows, function (row) {
                    if ((row.name == transaction.investor) && row.email) {
                        transaction.email = row.email;
                    }
                });
                if (!transaction.email) {
                    transaction.email = null
                }
                SWBrijj.proc('ownership.update_transaction', String(transaction['tran_id']), transaction['email'], transaction['investor'], transaction['issue'], transaction['units'], d1, transaction['type'], transaction['amount'], parseFloat(transaction['premoney']), parseFloat(transaction['postmoney']), parseFloat(transaction['ppshare']), parseFloat(transaction['totalauth']), partpref, transaction.liquidpref, transaction['optundersec'], parseFloat(transaction['price']), parseFloat(transaction['terms']), vestcliffdate, parseFloat(transaction['vestcliff']), transaction['vestfreq'], transaction['debtundersec'], parseFloat(transaction['interestrate']), transaction['interestratefreq'], parseFloat(transaction['valcap']), parseFloat(transaction['discount']), parseFloat(transaction['term']), dragalong, tagalong).then(function (data) {
                    $scope.lastsaved = Date.now();
                    var tempunits = 0;
                    var tempamount = 0;
                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.trans, function (tran) {
                            if (row.name == tran.investor) {
                                if (transaction.tran_id == '' && !tran.tran_id && (!isNaN(parseFloat(tran.units)) || !isNaN(parseFloat(tran.amount)))) {
                                    tran.tran_id = data[1][0];
                                    for (var i=0; i < $scope.trans.length; i++) {
                                        if ($scope.trans[i] == tran) {
                                            $scope.$watch('trans['+i+']', function(newval, oldval) {
                                                $scope.transaction_watch(newval, oldval);
                                            }, true);
                                        }
                                    }
                                }
                                if (tran.investor == transaction.investor && tran.issue == transaction.issue) {
                                    tran.date = tran.date;
                                    tran.key = tran.issue;
                                    tran.unitskey = tran.units;
                                    tran.paidkey = tran.amount;
                                    transaction.datekey = d1;
                                    tempunits = calculate.sum(tempunits, tran.units);
                                    tempamount = calculate.sum(tempamount, tran.amount);
                                    if (!isNaN(parseFloat(tran.forfeited))) {
                                        tempunits = calculate.sum(tempunits, (-tran.forfeited));
                                    }
                                    row[tran.issue]['u'] = tempunits;
                                    row[tran.issue]['ukey'] = tempunits;
                                    row[tran.issue]['a'] = tempamount;
                                    row[tran.issue]['akey'] = tempamount;

                                    if (row[tran.issue]['u'] == 0) {
                                        row[tran.issue]['u'] = null;
                                        row[tran.issue]['akey'] = null;
                                    }
                                    if (row[tran.issue]['a'] == 0) {
                                        row[tran.issue]['a'] = null;
                                        row[tran.issue]['akey'] = null;
                                    }
                                    row[tran.issue]['x'] = 0;
                                }
                            }
                        });
                    });

                    angular.forEach($scope.issues, function (x) {
                        $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
                    });

                    $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(transaction.issue));



                    if (transaction.type == "Option" && !isNaN(parseFloat(transaction.amount))) {
                        var modGrant = {"unit": null, "tran_id": transaction.tran_id, "date": (Date.today()), "action": "exercised", "investor": transaction.investor, "issue": transaction.issue};
                        var previousTotal = 0
                        angular.forEach($scope.grants, function(grant) {
                            if (transaction.tran_id == grant.tran_id && grant.action == "exercised") {
                                previousTotal = previousTotal + grant.unit;
                            }
                        });
                        var units = transaction.amount - (previousTotal * transaction.price);
                        modGrant.unit = (units / transaction.price);
                        angular.forEach($scope.grants, function (grant) {
                            if (transaction.tran_id == grant.tran_id && grant.action == "exercised") {
                                var offset = grant.date.getTimezoneOffset();
                                var today = Date.today().addMinutes(-offset).toUTCString();
                                if (grant.date.toUTCString() == today) {
                                    modGrant.unit = modGrant.unit + grant.unit;
                                    modGrant.grant_id = grant.grant_id;
                                }
                            }
                        });
                        $scope.saveGrant(modGrant);
                    }

                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issues, function (issue) {
                            if (row[issue.issue] != undefined) {
                                if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u'])) || row[issue.issue]['u'] == 0) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                                    row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                                }
                            }
                        });
                    });

                    //Calculate the total vested for each row
                    $scope.rows = calculate.detailedvested($scope.rows, $scope.trans);

                    // Make sure we have a clean slate for everyone (including any new unissued rows
                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issuekeys, function (issuekey) {
                            if (issuekey in row) {
                            }
                            else {
                                row[issuekey] = {"u": null, "a": null, "ukey": null, "akey": null};
                            }
                        });
                    });
                });
            };
        }
    };

    // Function for saving grant. Used on the captable when paid is updated from the captable on an option
    $scope.saveGrant = function (grant) {
        if (grant.action == "" && (isNaN(parseFloat(grant.unit)) || parseFloat(grant.unit) == 0)) {
            if (grant.grant_id != null) {
                SWBrijj.proc('ownership.delete_grant', parseInt(grant.grant_id)).then(function (data) {
                    $scope.lastsaved = Date.now();
                    var index = $scope.grants.indexOf(grant);
                    $scope.grants.splice(index, 1);
                });
            }
            else {
                return;
            }
        }
        if (grant.action == "" || grant.action == undefined || isNaN(parseFloat(grant.unit)) || parseFloat(grant.unit) <= 0) {
            return;
        }
        if (grant.grant_id == undefined) {
            grant.grant_id = "";
        }
        var d1 = grant['date'].toUTCString();
        SWBrijj.proc('ownership.update_grant', String(grant.grant_id), String(grant.tran_id), grant.action, d1, parseFloat(grant.unit)).then(function (data) {
            $scope.lastsaved = Date.now();
            if (grant.grant_id == "") {
                grant.grant_id = data[1][0];
                $scope.grants.push(grant);
            }
            else {
                angular.forEach($scope.grants, function(x) {
                    if (x.grant_id == grant.grant_id) {
                        x = grant
                    }
                });
            }
        });
    };

    $scope.strToBool = function (string) {
        switch (String(string).toLowerCase()) {
            case "true":
            case "yes":
            case "1":
                return true;
            case "false":
            case "no":
            case "0":
                return false;
            case null:
            case undefined:
            case "undefined":
                return null;
            default:
                return Boolean(string);
        }
    };

    $scope.canHover = function (row) {
        if (row['u'] || row['a']) {
            return true
        }
        else {
            return false
        }
    };


    // Function to inherit all the values from the issue to new and updating transactions
    $scope.tranInherit = function (tran, issue) {
        tran.issue = issue.issue;
        tran.type = issue.type;
        tran.totalauth = issue.totalauth;
        tran.premoney = issue.premoney;
        tran.postmoney = issue.postmoney;
        tran.ppshare = issue.ppshare;
        tran.totalauth = issue.totalauth;
        tran.liquidpref = issue.liquidpref;
        tran.partpref = issue.partpref;
        tran.optundersec = issue.optundersec;
        tran.price = issue.price;
        tran.terms = issue.terms;
        tran.vestingbegins = issue.vestingbegins;
        tran.vestcliff = issue.vestcliff;
        tran.vestfreq = issue.vestfreq;
        tran.debtundersec = issue.debtundersec;
        tran.interestrate = issue.interestrate;
        tran.interestratefreq = issue.interestratefreq;
        tran.valcap = issue.valcap;
        tran.discount = issue.discount;
        tran.term = issue.term;
        tran.dragalong = issue.dragalong;
        tran.tagalong = issue.tagalong;
        return tran
    };

    $scope.editViewToggle = function() {
        $scope.maintoggle = !$scope.maintoggle;
        $scope.radioModel = $scope.maintoggle ? "Edit" : "View";
        angular.forEach($scope.rows, function (row) {
            row.state = false;
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue) {
                    row[issue.issue].state = false;
                    issue.state = false;
                }
            });
        });
    };

    $scope.toggleView = function () {
        if ($scope.maintoggle) {
            $scope.captablestate = 1;
            if ($scope.sideBar == 2 || $scope.sideBar == 1) {
                $scope.sideBar = "hello";
            }
            return true;
        }
        else {
            $scope.dilutionSwitch = true;
            $scope.captablestate = 0;
            if ($scope.sideBar == 4 || $scope.sideBar == 5) {
                $scope.sideBar = "hello";
            }
            return false;
        }
    };

    // Toggles editable to view
    $scope.toggleDilution = function () {
        return $scope.dilutionSwitch;
    };

    // Toggles sidebar back and forth
    $scope.toggleSide = function () {
        if (!$scope.sideToggle) {
            $scope.sideToggleName = "Hide";
            return false
        } else {
            $scope.sideToggleName = "Details";
            return true
        }
    };


    // Captable Conversion Modal

    $scope.convertSharesUp = function(trans) {
        $scope.convertTran = {};
        $scope.convertTran.tran = trans[0];
        $scope.convertTran.newtran = {}
        $scope.convertTran.step = '1';
        $scope.convertTran.date = new Date.today();
        $scope.convertTransOptions = trans;
        $scope.convertModal = true;

        $scope.$watch('convertTran.ppshare', function(newval, oldval) {
            if (isNaN(newval) && !null) {
                $scope.convertTran.ppshare = oldval;
            }
        }, true);
    };

    $scope.convertSharesClose = function() {
        $scope.convertModal = false;
    };

    $scope.convertgoto = function(number) {
        $scope.convertTran.step = number;
        if (number == '2') {
            $scope.convertTran.newtran = angular.copy($scope.convertTran.tran);
            $scope.convertTran.newtran = $scope.tranInherit($scope.convertTran.newtran, $scope.convertTran.toissue);
            $scope.convertTran.newtran.amount = calculate.debtinterest($scope.convertTran);
            $scope.convertTran.newtran = calculate.conversion($scope.convertTran);
        }
    };

    $scope.convertopts = {
        backdropFade: true,
        dialogFade: true,
        dialogClass: 'convertModal modal'
    };

    // Filters the dropdown to only equity issues
    $scope.justEquity = function(issues, tran) {
        var list = [];
        angular.forEach(issues, function(issue) {
            if (issue.type == "Equity" && issue.issue != tran.issue) {
                list.push(issue);
            }
        });
        return list;
    };

    $scope.assignConvert = function(tran) {
        $scope.convertTran.tran = tran;
    }

    // Performs the assignment for the dropdown selectors
    $scope.assignConvert = function(field, value) {
        $scope.convertTran[field] = value;
        if (field == "toissue") {
            $scope.convertTran.method = null;
        }
    };

    // Date grabber
    $scope.dateConvert = function (evt) {
        //Fix the dates to take into account timezone differences
        if (evt) { // User is typing
            if (evt != 'blur')
                keyPressed = true;
            var dateString = angular.element('converttrandate').val();
            var charCode = (evt.which) ? evt.which : event.keyCode; // Get key
            if (charCode == 13 || (evt == 'blur' && keyPressed)) { // Enter key pressed or blurred
                var date = Date.parse(dateString);
                if (date) {
                    $scope.convertTran.date = date;
                    var offset = $scope.convertTran.date.getTimezoneOffset();
                    $scope.convertTran.date = $scope.convertTran.date.addMinutes(offset);
                    keyPressed = false;
                }
            }
        } else { // User is using calendar
            if ($scope.convertTran.date instanceof Date) {
                var offset = $scope.convertTran.date.getTimezoneOffset();
                $scope.convertTran.date = $scope.convertTran.date.addMinutes(offset);
                keyPressed = false;
            }
        }
    };

    $scope.performConvert = function (tranConvert) {
        var newtran = tranConvert.newtran;
        SWBrijj.proc('ownership.conversion', newtran.tran_id, newtran.issue, tranConvert.date, tranConvert.method, parseFloat(newtran.ppshare), parseFloat(newtran.units), parseFloat(newtran.amount)).then(function (tranid) {
            $scope.lastsaved = Date.now();
            var oldid = angular.copy(newtran.tran_id);
            newtran.tran_id = tranid[1][0];
            newtran.key = newtran.issue;
            newtran.unitskey = newtran.units;
            newtran.paidkey = newtran.amount;
            newtran.convert = [{"issuefrom": tranConvert.tran.issue, "tranto": newtran.tran_id, "company": newtran.company, "effectivepps": newtran.ppshare, "method": tranConvert.method, "date": tranConvert.date, "tranfrom": oldid}]
            var tempunits = 0;
            var tempamount = 0;
            var index;
            var decrement = {};
            angular.forEach($scope.trans, function (tran) {
                if (tran.tran_id == oldid) {
                    index = $scope.trans.indexOf(tran);
                    decrement.issue = tran.issue;
                    decrement.units = tran.units;
                    decrement.amount = tran.amount;
                    decrement.investor = tran.investor;

                }
            });
            $scope.trans.splice(index, 1);
            $scope.trans.push(newtran);

            angular.forEach($scope.rows, function (row) {
                if (row[decrement.issue] && row.name == decrement.investor) {
                    row[decrement.issue].u = row[decrement.issue].u - decrement.units;
                    row[decrement.issue]['a'] = row[decrement.issue]['a'] - decrement.amount;
                }
                angular.forEach($scope.trans, function (tran) {
                    if (row.name == tran.investor) {
                        if (tran.investor == newtran.investor && tran.issue == newtran.issue) {
                            tempunits = calculate.sum(tempunits, tran.units);
                            tempamount = calculate.sum(tempamount, tran.amount);
                            if (!isNaN(parseFloat(tran.forfeited))) {
                                tempunits = calculate.sum(tempunits, (-tran.forfeited));
                            }
                            row[tran.issue]['u'] = tempunits;
                            row[tran.issue]['ukey'] = tempunits;
                            row[tran.issue]['a'] = tempamount;
                            row[tran.issue]['akey'] = tempamount;

                            if (row[tran.issue]['u'] == 0) {
                                row[tran.issue]['u'] = null;
                                row[tran.issue]['akey'] = null;
                            }
                            if (row[tran.issue]['a'] == 0) {
                                row[tran.issue]['a'] = null;
                                row[tran.issue]['akey'] = null;
                            }
                            row[tran.issue]['x'] = 0;
                        }
                    }
                });
            });

            angular.forEach($scope.issues, function (x) {
                $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
            });

            $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(newtran.issue));


            angular.forEach($scope.rows, function (row) {
                angular.forEach($scope.issues, function (issue) {
                    if (row[issue.issue] != undefined) {
                        if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u'])) || row[issue.issue]['u'] == 0) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                            row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                        }
                    }
                });
            });

            //Calculate the total vested for each row
            $scope.rows = calculate.detailedvested($scope.rows, $scope.trans);

            // Make sure we have a clean slate for everyone (including any new unissued rows
            angular.forEach($scope.rows, function (row) {
                angular.forEach($scope.issuekeys, function (issuekey) {
                    if (issuekey in row) {
                    }
                    else {
                        row[issuekey] = {"u": null, "a": null, "ukey": null, "akey": null};
                    }
                });
            });
            $scope.$emit("notification:success", "Conversion Successful");
        }).except(function(err) {
                $scope.$emit("notification:fail", "Conversion Failed");
            });
    };

    // Captable Split Modal

    $scope.splitSharesUp = function(issue) {
        $scope.splitIssue = angular.copy(issue);
        $scope.splitIssue.ratioa = 1;
        $scope.splitIssue.ratiob = 1;
        $scope.splitIssue.date = new Date.today();
        $scope.splitModal = true;
    };

    $scope.splitSharesClose = function() {
        $scope.splitModal = false;
    };

    // Date grabber
    $scope.dateSplit = function (evt) {
        //Fix the dates to take into account timezone differences
        if (evt) { // User is typing
            if (evt != 'blur')
                keyPressed = true;
            var dateString = angular.element('splitissuedate').val();
            var charCode = (evt.which) ? evt.which : event.keyCode; // Get key
            if (charCode == 13 || (evt == 'blur' && keyPressed)) { // Enter key pressed or blurred
                var date = Date.parse(dateString);
                if (date) {
                    $scope.splitIssue.date = date;
                    var offset = $scope.splitIssue.date.getTimezoneOffset();
                    $scope.splitIssue.date = $scope.splitIssue.date.addMinutes(offset);
                    keyPressed = false;
                }
            }
        } else { // User is using calendar
            if ($scope.splitIssue.date instanceof Date) {
                var offset = $scope.splitIssue.date.getTimezoneOffset();
                $scope.splitIssue.date = $scope.splitIssue.date.addMinutes(offset);
                keyPressed = false;
            }
        }
    };

    $scope.totalinissue = function(issue) {
        var total = 0;
        angular.forEach($scope.trans, function(tran) {
            if (tran.issue == issue.issue) {
                total += tran.units;
                if (tran.forfeited) {
                    total -= tran.forfeited
                }
            }
        });
        return total;
    };

    $scope.splitvalue = function(issue) {
        var ratio = parseFloat(issue.ratioa) / parseFloat(issue.ratiob);
        if (!isNaN(ratio)) {
            return ($scope.totalinissue(issue) / ratio);
        }
    };

    $scope.splitppshare = function(issue) {
        var ratio = parseFloat(issue.ratioa) / parseFloat(issue.ratiob);
        if (!isNaN(ratio)) {
            if (issue.type == "Equity") {
                return (issue.ppshare * ratio);
            }
            else if (issue.type == "Option") {
                return (issue.price * ratio);
            }
        }
    };

    $scope.performSplit = function(issue) {
        var ratio = parseFloat(issue.ratioa) / parseFloat(issue.ratiob);
        if (!isNaN(ratio)) {
            SWBrijj.proc('ownership.split', issue.issue, ratio, issue.date).then(function (data) {
                $scope.lastsaved = Date.now();
                angular.forEach($scope.trans, function(tran) {
                     if (tran.issue == issue.issue) {
                         tran.units = tran.units / ratio;
                         var fraction = new Fraction(ratio);
                         if (issue.type == "Equity") {
                             tran.ppshare = tran.ppshare * ratio;
                             tran.convert.push({"issuefrom": tran.issue, "tranto": tran.tran_id, "company": tran.company, "effectivepps": tran.ppshare, "method": "Split", "date": issue.date, "tranfrom": tran.tran_id, "split" : fraction});
                         }
                         else if (issue.type == "Option") {
                             tran.price = tran.price * ratio;
                             tran.convert.push({"issuefrom": tran.issue, "tranto": tran.tran_id, "company": tran.company, "effectivepps": tran.price, "method": "Split", "date": issue.date, "tranfrom": tran.tran_id, "split" : fraction});
                         }
                     }
                 });
                angular.forEach($scope.rows, function (row) {
                    var tempunits = 0;
                    var tempamount = 0;
                    angular.forEach($scope.trans, function (tran) {
                        if (row.name == tran.investor) {
                            if (tran.issue == issue.issue) {
                                tempunits = calculate.sum(tempunits, tran.units);
                                tempamount = calculate.sum(tempamount, tran.amount);
                                if (!isNaN(parseFloat(tran.forfeited))) {
                                    tempunits = calculate.sum(tempunits, (-tran.forfeited));
                                }
                                row[tran.issue]['u'] = tempunits;
                                row[tran.issue]['ukey'] = tempunits;
                                row[tran.issue]['a'] = tempamount;
                                row[tran.issue]['akey'] = tempamount;

                                if (row[tran.issue]['u'] == 0) {
                                    row[tran.issue]['u'] = null;
                                    row[tran.issue]['akey'] = null;
                                }
                                if (row[tran.issue]['a'] == 0) {
                                    row[tran.issue]['a'] = null;
                                    row[tran.issue]['akey'] = null;
                                }
                                row[tran.issue]['x'] = 0;
                            }
                        }
                    });
                });

                angular.forEach($scope.issues, function (x) {
                    $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
                    if (x.issue == issue.issue) {
                        x.ppshare = x.ppshare * ratio;
                    }
                });

                $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(issue.issue));


                angular.forEach($scope.rows, function (row) {
                    angular.forEach($scope.issues, function (issue) {
                        if (row[issue.issue] != undefined) {
                            if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u'])) || row[issue.issue]['u'] == 0) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                                row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                            }
                        }
                    });
                });

                //Calculate the total vested for each row
                $scope.rows = calculate.detailedvested($scope.rows, $scope.trans);

                // Make sure we have a clean slate for everyone (including any new unissued rows
                angular.forEach($scope.rows, function (row) {
                    angular.forEach($scope.issuekeys, function (issuekey) {
                        if (issuekey in row) {
                        }
                        else {
                            row[issuekey] = {"u": null, "a": null, "ukey": null, "akey": null};
                        }
                    });
                });
                $scope.$emit("notification:success", "Split Successful");
            }).except(function(err) {
                    $scope.$emit("notification:fail", "Split Failed");
                });
        }
    };

    // Captable Transfer Modal

    $scope.transferSharesUp = function(activetran) {
        $scope.transferModal = true;
        $scope.transfer = {};
        $scope.transfer.trans = angular.copy(activetran);
        $scope.transfer.date = new Date.today();
        for (var i=0; i < $scope.transfer.trans.length; i++) {
            $scope.transfer.trans[i].transferunits = 0;

            // This watch caps the amount you can transfer to the units available
            // This seems depressingly long winded, definitely worth looking into further
            $scope.$watch('transfer.trans['+i+']', function(newval, oldval) {
                if (parseFloat(newval.transferunits) > parseFloat(oldval.units) || newval.transferunits == "-" || parseFloat(newval.transferunits) < 0) {
                    for (var x=0; x < $scope.transfer.trans.length; x++) {
                        if ($scope.transfer.trans[x].tran_id == newval.tran_id) {
                            $scope.transfer.trans[x].transferunits = oldval.transferunits;
                        }
                    }
                }
            }, true);
        }
    };

    $scope.transferSharesClose = function() {
        $scope.transferModal = false;
    };

    $scope.transferopts = {
        backdropFade: true,
        dialogFade: true,
        dialogClass: 'transferModal modal'
    };

    $scope.performTransfer = function() {
        angular.forEach($scope.transfer.trans, function(tran) {
            var transferunits = parseFloat(tran.transferunits);
            if (tran.transferto && !isNaN(tran.transferunits)) {
                SWBrijj.proc('ownership.transfer', tran.tran_id, tran.transferto, transferunits, $scope.transfer.date).then(function (data) {
                    $scope.lastsaved = Date.now();
                    var newtran = angular.copy(tran);
                    newtran.tran_id = data[1][0];
                    newtran.investor = tran.transferto;
                    newtran.convert.push({"investor_to": tran.transferto, "investor_from": tran.investor, "company": tran.company, "units": transferunits, "direction": "To", "date": $scope.transfer.date});
                    var tempunits = 0;
                    var tempamount = 0;
                    var index;
                    var decrement = {};
                    angular.forEach($scope.trans, function (x) {
                        if (x.tran_id == tran.tran_id) {
                            index = $scope.trans.indexOf(x);
                            x.convert.push({"investor_to": tran.transferto, "investor_from": tran.investor, "company": tran.company, "units": transferunits, "direction": "From", "date": $scope.transfer.date});
                            decrement.issue = x.issue;
                            decrement.units = transferunits;
                            decrement.amount = x.amount * (transferunits/x.units);
                            decrement.investor = x.investor;

                        }
                    });
                    if (tran.units - transferunits == 0) {
                        $scope.trans.splice(index, 1);
                    }
                    newtran.units = decrement.units;
                    newtran.amount = decrement.amount;
                    $scope.trans.push(newtran);

                    angular.forEach($scope.rows, function (row) {
                        if (row[decrement.issue] && row.name == decrement.investor) {
                            row[decrement.issue].u = row[decrement.issue].u - decrement.units;
                            row[decrement.issue]['a'] = row[decrement.issue]['a'] - decrement.amount;
                        }
                        angular.forEach($scope.trans, function (tran) {
                            if (row.name == tran.investor) {
                                if (tran.investor == newtran.investor && tran.issue == newtran.issue) {
                                    tempunits = calculate.sum(tempunits, tran.units);
                                    tempamount = calculate.sum(tempamount, tran.amount);
                                    if (!isNaN(parseFloat(tran.forfeited))) {
                                        tempunits = calculate.sum(tempunits, (-tran.forfeited));
                                    }
                                    row[tran.issue]['u'] = tempunits;
                                    row[tran.issue]['ukey'] = tempunits;
                                    row[tran.issue]['a'] = tempamount;
                                    row[tran.issue]['akey'] = tempamount;

                                    if (row[tran.issue]['u'] == 0) {
                                        row[tran.issue]['u'] = null;
                                        row[tran.issue]['akey'] = null;
                                    }
                                    if (row[tran.issue]['a'] == 0) {
                                        row[tran.issue]['a'] = null;
                                        row[tran.issue]['akey'] = null;
                                    }
                                    row[tran.issue]['x'] = 0;
                                }
                            }
                        });
                    });

                    angular.forEach($scope.issues, function (x) {
                        $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(x.issue));
                    });

                    $scope.rows = calculate.unissued($scope.rows, $scope.issues, String(newtran.issue));


                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issues, function (issue) {
                            if (row[issue.issue] != undefined) {
                                if (issue.type == "Debt" && (isNaN(parseFloat(row[issue.issue]['u'])) || row[issue.issue]['u'] == 0) && !isNaN(parseFloat(row[issue.issue]['a']))) {
                                    row[issue.issue]['x'] = calculate.debt($scope.rows, issue, row);
                                }
                            }
                        });
                    });

                    //Calculate the total vested for each row
                    $scope.rows = calculate.detailedvested($scope.rows, $scope.trans);

                    // Make sure we have a clean slate for everyone (including any new unissued rows)
                    angular.forEach($scope.rows, function (row) {
                        angular.forEach($scope.issuekeys, function (issuekey) {
                            if (issuekey in row) {
                            }
                            else {
                                row[issuekey] = {"u": null, "a": null, "ukey": null, "akey": null};
                            }
                        });
                    });
                    $scope.$emit("notification:success", "Transfer Successful");
                }).except(function(err) {
                        $scope.$emit("notification:fail", "Transfer failed");
                    });
            }
        });
    };


    // Date grabber
    $scope.dateTransfer = function (evt) {
        //Fix the dates to take into account timezone differences
        if (evt) { // User is typing
            if (evt != 'blur')
                keyPressed = true;
            var dateString = angular.element('transferdate').val();
            var charCode = (evt.which) ? evt.which : event.keyCode; // Get key
            if (charCode == 13 || (evt == 'blur' && keyPressed)) { // Enter key pressed or blurred
                var date = Date.parse(dateString);
                if (date) {
                    $scope.transfer.date = date;
                    var offset = $scope.transfer.date.getTimezoneOffset();
                    $scope.transfer.date = $scope.transfer.date.addMinutes(offset);
                    keyPressed = false;
                }
            }
        } else { // User is using calendar
            if ($scope.transfer.date instanceof Date) {
                var offset = $scope.transfer.date.getTimezoneOffset();
                $scope.transfer.date = $scope.transfer.date.addMinutes(offset);
                keyPressed = false;
            }
        }
    };


    $scope.trantorow = function(tran, name) {
        tran.transferto = name;
    };

    $scope.isDebt = function(key) {
        var done = true;
        angular.forEach($scope.issues, function(issue) {
            if (key == issue.issue && issue.type=="Debt") {
                done = false
                return false
            }
        });
        if (done) {
            return true
        }
    };

    //Captable Delete Issue Modal

    $scope.tourUp = function () {
        $scope.tourModal = true;
    };

    $scope.tourclose = function () {
        $scope.tourModal = false;
    };

    $scope.touropts = {
        backdropFade: true,
        dialogFade: true,
        dialogClass: 'tourModal modal'
    };

    //Captable Delete Issue Modal

    $scope.dmodalUp = function (issue) {
        $scope.capDelete = true;
        $scope.missue = issue;
    };

    $scope.dclose = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.capDelete = false;
    };

    //Captable row delete modal

    $scope.rmodalUp = function (investor) {
        $scope.rowDelete = true;
        $scope.minvestor = investor.namekey;
    };

    $scope.rclose = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.rowDelete = false;
    };

    // Captable transaction delete modal
    $scope.tranDeleteUp = function (transaction) {
        $scope.deleteTran = transaction;
        $scope.tranDelete = true;
    };

    $scope.deleteclose = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.tranDelete = false;
    };

    //modal for updating issue fields that have different underlying values

    $scope.imodalUp = function (issue, field) {
        $scope.issueModal = true;
        $scope.changedIssue = issue;
        $scope.changedIssueField = field;
    };

    $scope.iclose = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.issueModal = false;
    };

    $scope.irevert = function (issue) {
        for (var i = 0, l = $scope.issues.length; i < l; i++) {
            if ($scope.issues[i].issue == issue.issue) {
                $scope.issues[i] = angular.copy($scope.issueRevert);
                $scope.activeIssue = angular.copy($scope.issueRevert);
            }
        };
    };


    //Adding to a row with more than one transaction modal

    $scope.mmodalUp = function (number, type, transaction) {
        $scope.changedNum = number;
        $scope.changedType = type;
        $scope.changedTransactions = transaction;
        $scope.capMulti = true;
    };

    $scope.mclose = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.capMulti = false;
    };

    $scope.dateoptions = function (trans) {
        var options = [];
        angular.forEach(trans, function (row) {
            options.push(row);
        });

        return options;
    };

    $scope.pickmOption = function(value) {
        $scope.pickTran = value;
        $scope.newtransaction = null;
    };

    $scope.pickOddOption = function(value) {
        $scope.newtransaction = value;
        $scope.pickTran = null;
    };

    $scope.mComplete = function (transactions, picked, number, type) {
        var inIssue = transactions[0].issue;
        if (!picked) {
            if (type == "u") {
                var newTran = {"active": true, "atype": 0, "new": "yes", "investor": $scope.activeTran[0].investor, "investorkey": $scope.activeTran[0].investor, "company": $scope.currentCompany, "date": (Date.today()), "datekey": (Date.today()), "issue": (inIssue), "units": number, "paid": null, "unitskey": number, "paidkey": null, "key": undefined, "convert": []};
            }
            else {
                var newTran = {"active": true, "atype": 0, "new": "yes", "investor": $scope.activeTran[0].investor, "investorkey": $scope.activeTran[0].investor, "company": $scope.currentCompany, "date": (Date.today()), "datekey": (Date.today()), "issue": (inIssue), "units": null, "paid": number, "unitskey": null, "paidkey": number, "key": undefined, "convert": []};
            }
            angular.forEach($scope.issues, function (issue) {
                if (issue.issue == inIssue) {
                    newTran = $scope.tranInherit(newTran, issue);
                }
            });
            if (number < 0 && newTran.type == "Option") {
                $scope.$emit("notification:fail", "Cannot have a negative amount for options");
                return;
            }
            $scope.trans.push(newTran);
            $scope.activeTran.push(newTran);
            for (var i = 0; i < $scope.activeTran.length; i++) {
                if (i + 1 == $scope.activeTran.length) {
                    $scope.activeTran[i].active = true;
                }
                else {
                    $scope.activeTran[i].active = false;
                }
            }
        }
        else {
            if (type == "u") {
                picked.units = picked.units + number;
            }
            else {
                picked.amount = picked.amount + number;
            }
            var newTran = picked;
        }
        $scope.saveTran(newTran);
    };

    $scope.mReset = function () {
        angular.forEach($scope.rows, function (row) {
            if (row.name == $scope.activeTran[0].investor) {
                row[$scope.activeTran[0].issue]['u'] = row[$scope.activeTran[0].issue]['ukey'];
                row[$scope.activeTran[0].issue]['a'] = row[$scope.activeTran[0].issue]['akey'];
            }
        });
    };


    // Captable Sharing Modal
    $scope.modalUp = function () {
        $scope.capShare = true;
    };

    $scope.close = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.capShare = false;
    };

    $scope.shareopts = {
        backdropFade: true,
        dialogFade: true,
        dialogClass: 'capshareModal modal'
    };

    // Alter already shared row's email address
    $scope.alterEmailModalUp = function (email) {
        $scope.capEditEmail = true;
        $scope.oldEmail = email;
        $scope.newEmail = angular.copy(email);
    };

    $scope.alterEmailModalClose = function () {
        $scope.closeMsg = 'I was closed at: ' + new Date();
        $scope.capEditEmail = false;
    };

    $scope.alterEmail = function() {
        if ($scope.newEmail != "") {
            SWBrijj.proc('ownership.update_row_share', $scope.newEmail, $scope.oldEmail, $scope.activeInvestorName).then(function (data) {
                $scope.lastsaved = Date.now();
                angular.forEach($scope.rows, function (row) {
                    if (row.name == $scope.activeInvestorName) {
                        $scope.$emit("notification:success", "Email address updated");
                        row.email = $scope.newEmail;
                        row.emailkey = row.email;
                        $scope.activeInvestorEmail = $scope.newEmail;
                    }
                });
            });
        }
    };

    $scope.opts = {
        backdropFade: true,
        dialogFade: true
    };

    // Adds new rows to the non-shareholder sharing
    $scope.addRemove = function () {
        var add = 0;
        angular.forEach($scope.extraPeople, function (people) {
            if (people.email) {
                add = add + 1
            }
        });
        if (add == $scope.extraPeople.length) {
            $scope.extraPeople.push({"email": ""});
        }
    };


    // Controls the orange border around the send boxes if an email is not given
    $scope.emailCheck = function (bool, person) {
        if (bool) {
            return !person;
        }
        else {
            return false;
        }
    };

    $scope.autoCheck = function(person) {
        return person != null && person.length > 0;
    };

    $scope.turnOnShares = function () {
        angular.forEach($scope.rows, function (row) {
            row.send = $scope.selectAll;
        });
    };


    // Send the share invites from the share modal
    $scope.sendInvites = function () {
        angular.forEach($scope.rows, function (row) {
            if (row.send == true) {
                SWBrijj.procm("ownership.share_captable", row.email.toLowerCase(), row.name).then(function (data) {
                    $scope.lastsaved = Date.now();
                    $scope.$emit("notification:success", "Your table has been shared!");
                    row.send = false;
                    row.emailkey = row.email;
                }).except(function(err) {
                        $scope.$emit("notification:fail", "Email : " + row.email + " failed to send");
                    });
            }
        });

        // Handles the non-shareholder shares
        if ($scope.extraPeople.length > 0) {
            angular.forEach($scope.extraPeople, function (people) {
                if (people.email) {
                    SWBrijj.procm("ownership.share_captable", people.email.toLowerCase(), "").then(function (data) {
                        SWBrijj.proc('ownership.update_investor_captable', people.email.toLowerCase(), 'Full View').then(function (data) {
                            $scope.lastsaved = Date.now();
                            $scope.$emit("notification:success", "Your table has been shared!");
                        });
                    }).except(function(err) {
                            $scope.$emit("notification:fail", "Email : " + people.email + " failed to send");
                        });
                }
            });
            $scope.extraPeople = [];
            $scope.extraPeople.push({'email': ""});
        }
    };

    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    $scope.fieldCheck = function(email) {
        return re.test(email);
    };


    // Prevents the share button from being clickable until a send button has been clicked and an address filled out
    $scope.checkInvites = function () {
        var checkcontent = false;
        var checksome = false;
        angular.forEach($scope.rows, function(row) {
            if (row.send == true && (row.email != null && row.email != "" && $scope.fieldCheck(row.email))) {
                checkcontent = true;
            }
            if (row.send == true) {
                checksome = true;
            }
        });
        if ($scope.extraPeople.length > 0 && $scope.extraPeople[0].email && $scope.fieldCheck($scope.extraPeople[0].email)) {
            return false;
        }
        else {
            return !(checkcontent && checksome);
        }
    };

    $scope.moveTour = function() {
        $scope.tourstate += 1;
        if ($scope.tourstate > 4) {
            $scope.tourstate = 0;
        }
        if ($scope.tourstate == 3) {
            $scope.sideToggle = false;
        }
    };

    $scope.gotoTour = function(x) {
        $scope.tourstate = parseInt(x);
    }

    $scope.closeTour = function() {
        $scope.tourstate = 0;
        $scope.tourshow = false;
    };

    //switches the sidebar based on the type of the issue
    $scope.funcformatAmount = function (amount) {
        return calculate.funcformatAmount(amount);
    };

    var memformatamount = memoize($scope.funcformatAmount);
    $scope.formatAmount = function(amount) {
        return memformatamount(amount);
    };

    $scope.formatDollarAmount = function(amount) {
        var output = calculate.formatMoneyAmount(memformatamount(amount), $scope.settings);
        return (output);
    };

    $scope.typeLocked = function(issue) {
        if (issue.liquidpref || issue.interestrate || issue.valcap || issue.discount || issue.optundersec || issue.vestcliff || issue.vestingbegins || issue.vestfreq) {
            return false
        }
        else {
            return true
        }
    };

    // Functions derived from services for use in the table

    //switches the sidebar based on the type of the issue
    $scope.dilution = function () {
        $scope.sideBar = 9;
        $scope.dilutedRows = calculate.dilution($scope.rows, $scope.issues);
    };

    //switches the sidebar based on the type of the issue
    $scope.trantype = function (type, activetype) {
        return switchval.trantype(type, activetype);
    };

    // Number of shareholders
    $scope.numShareholders = function() {
        return calculate.numShareholders($scope.rows);
    };

    // Total Shares in captable
    var totalShares = memoize(calculate.totalShares)
    $scope.totalShares = function(rows) {
        return $scope.formatAmount(totalShares(rows));
    };

    // Total Shares | Paid for an issue column (type is either u or a)
    var totalPaid = memoize(calculate.totalPaid);
    $scope.totalPaid = function(rows) {
        return $scope.formatDollarAmount(totalPaid(rows));
    };

    // Total Shares for a shareholder row
    var shareSum = memoize(calculate.shareSum);
    $scope.shareSum = function(row) {
        return $scope.formatAmount(shareSum(row));
    };

    // Total Shares | Paid for an issue column (type is either u or a)
    var colTotalIssued = memoize(calculate.colTotalIssued);
    $scope.colTotalIssued = function(header, rows, type) {
        return colTotalIssued(header, rows, type);
    };

    // Total Shares | Paid for an issue column (type is either u or a)
    var colTotal = memoize(calculate.colTotal);
    $scope.colTotal = function(header, rows, type) {
        return colTotal(header, rows, type);
    };

    // Total percentage ownership for each shareholder row
    var sharePercentage = memoize(calculate.sharePercentage);
    $scope.sharePercentage = function(row, rows, issuekeys) {
        return sharePercentage(row, rows, issuekeys, shareSum(row), totalShares(rows));
    };

    // Total percentage ownership for each shareholder row
    $scope.pricePerShare = function() {
        return $scope.formatDollarAmount(calculate.pricePerShare($scope.issues, $scope.finishedsorting));
    };

    // Last issue date for the sidebar In Brief section
    $scope.lastIssue = function() {
        return calculate.lastIssue($scope.issues, $scope.finishedsorting);
    };

    // Last issue date for the sidebar In Brief section
    $scope.lastPostMoney = function() {
        return $scope.formatDollarAmount(calculate.lastPostMoney($scope.issues, $scope.finishedsorting));
    };

    //Watches constraining various values

    // This should really be in a directive (or more properly get some clever css set-up to do it for me...
    $scope.$watch(function() {return $(".leftBlock").height(); }, function(newValue, oldValue) {
        $scope.stretchheight = {height: String(newValue + 59) + "px"}
    });

    $scope.transaction_watch = function(newval, oldval) {
        if (newval && oldval && (parseFloat(newval.interestrate) > 100 || parseFloat(newval.interestrate) < 0)) {
            for (var x=0; x < $scope.trans.length; x++) {
                if ($scope.trans[x].tran_id == newval.tran_id) {
                    $scope.trans[x].interestrate = oldval.interestrate;
                }
            }
        }

        if (newval && oldval && (parseFloat(newval.discount) > 100 || parseFloat(newval.discount) < 0)) {
            for (var x=0; x < $scope.trans.length; x++) {
                if ($scope.trans[x].tran_id == newval.tran_id) {
                    $scope.trans[x].discount = oldval.discount;
                }
            }
        }

        if (newval && oldval && (parseFloat(newval.vestcliff) > 100 || parseFloat(newval.vestcliff) < 0)) {
            for (var x=0; x < $scope.trans.length; x++) {
                if ($scope.trans[x].tran_id == newval.tran_id) {
                    $scope.trans[x].vestcliff = oldval.vestcliff;
                }
            }
        }
    };

    $scope.issue_watch = function(newval, oldval) {
        if (newval && oldval && (parseFloat(newval.interestrate) > 100 || parseFloat(newval.interestrate) < 0)) {
            for (var x=0; x < $scope.issues.length; x++) {
                if ($scope.issues[x] && $scope.issues[x].tran_id == newval.tran_id) {
                    $scope.issues[x].interestrate = oldval.interestrate;
                }
            }
        }

        if (newval && oldval && (parseFloat(newval.discount) > 100 || parseFloat(newval.discount) < 0)) {
            for (var x=0; x < $scope.issues.length; x++) {
                if ($scope.issues[x] && $scope.issues[x].tran_id == newval.tran_id) {
                    $scope.issues[x].discount = oldval.discount;
                }
            }
        }

        if (newval && oldval && (parseFloat(newval.vestcliff) > 100 || parseFloat(newval.vestcliff) < 0)) {
            for (var x=0; x < $scope.issues.length; x++) {
                if ($scope.issues[x] && $scope.issues[x].tran_id == newval.tran_id) {
                    $scope.issues[x].vestcliff = oldval.vestcliff;
                }
            }
        }
    };

};

// IE fix to remove enter to submit form
function testForEnter()
{
    if (event.keyCode == 13)
    {
        event.cancelBubble = true;
        event.returnValue = false;
    }
}
