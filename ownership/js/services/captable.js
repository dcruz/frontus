'use strict';

var ownership = angular.module('ownerServices');

var CapTable = function() {
    this.investors = [];
    this.securities = [];
    this.transactions = [];
    this.ledger_entries = [];
    this.attributes = [];

    this.cells = [];
    this.grantCells = [];
};
var Transaction = function() {
    this.attrs = {};
    this.company = null;
    this.effective_date = null;
    this.entered_by = null;
    this.ip = null;
    this.evidence = null;
    this.evidence_data = null;
    this.insertion_date = null;
    this.transaction = null;
    this.kind = null;
    this.verified = false;
};
var Security = function() {
    this.name = "";
    this.new_name = "";
    this.effective_date = null;
    this.insertion_date = null;
    this.transactions = [];
    this.attrs = {};
};
var Investor = function() {
    this.name = "";
    this.new_name = "";
    this.email = "";
    this.access_level = "";
    this.editable = true;
    this.transactions = [];
};
var Cell = function() {
    this.u = null; // units
    this.a = null; // amount
    this.x = null; // percentage
    this.transactions = [];
    this.security = null;
    this.investor = null;
    this.valid = true;
};

var GrantCell = function() {
    this.u = null;
    this.transactions = [];
    this.root_tran = null;
    this.security = null;
    this.investor = null;
    this.kind = null;
};

/* The captable service is currently a generic ownership data service
 * AS WELL AS, a service performing all necessary data construction
 * and manipulation for the company and investor captables.
 *
 * TODO split this service into 2 parts: ownership and captable.
 * -  ownership should return an object via a promise
 * -  the object would contain transactions,
 *                             ledger entries,
 *                             investors,
 *                             securities
 *
 * Additional services should be created for the following:
 * -  grants
 * -  round modeling
 * -  debt conversion calculator
 *
 * Generally, whenever additional data structures beyond what is
 * modeled in the database (transactions and ledger entries) or
 * the primary nouns users expect (investors and securities) must be
 * created and maintained, there should be an additional service.
 *
 * How to keep everything in sync:
 * -  bind directly to the ownership object
 * -  implement a deepwatch in each service on the ownership object
 * -  AND / OR use emit/broadcast/on to notify downstream services of changes
 *    so derivative data structures can be updated as necessary
 *
 */
ownership.service('captable',
function($rootScope, navState, calculate, SWBrijj, $q, attributes, History, $filter) {

    function role() {
        return navState ? navState.role : document.sessionState.role;
    }
    /* tranFilter is run on captable.transactions
     * ledgerFilter is run on an array of transaction ids corresponding
     * to the results of the tranFilter
     */
    var grantColumns = [{name: "granted",
                         tranFilter: function(r) {
                             return function(t) {
                                 // TODO incorporate splits
                                 return t.transaction == r.transaction;
                             };
                         },
                         ledgerFilter: function(ids) {
                             return function(x) {
                                 return ids.indexOf(x.transaction) != -1;
                             };
                         }
                        },
                        {name: "vested",
                         tranFilter: function(r) {
                             return function(t) {
                                 return t.transaction == r.transaction;
                             };
                         },
                         ledgerFilter: function(ids) {
                             return function(x) {
                                 return ids.indexOf(x.transaction) != -1 &&
                                     x.effective_date <= Date.now();
                             };
                         }
                        },
                        {name: "forfeited",
                         tranFilter: function(r) {
                             return function(t) {
                                 return t.kind=="forfeit" &&
                                     t.attrs.transaction_from &&
                                     t.attrs.transaction_from == r.transaction;
                             };
                         },
                         ledgerFilter: function(ids) {
                             return function(x) {
                                 return ids.indexOf(x.transaction) != -1;
                             };
                         }
                        },
                        {name: "exercised",
                         tranFilter: function(r) {
                             return function(t) {
                                 return t.kind=="exercise" &&
                                     t.attrs.transaction_from &&
                                     t.attrs.transaction_from == r.transaction;
                             };
                         },
                         ledgerFilter: function(ids) {
                             return function(x) {
                                 return ids.indexOf(x.transaction) != -1;
                             };
                         }
                        }];
    this.grantColumns = grantColumns;

    var attrs = attributes.getAttrs();
    var captable = new CapTable();
    this.getCapTable = function() { return captable; };
    var loadInProgress = false;
    function loadCapTable() {
        loadInProgress = true;
        $q.all([loadLedger(),
                loadTransactionLog(),
                loadRowNames(),
                loadAttributes(),
                loadEvidence(),
                loadActivity(),
                loadLogins()])
        .then(function(results) {
            // reset the existing cap table
            captable.investors.splice(0);
            captable.securities.splice(0);
            captable.transactions.splice(0);
            captable.ledger_entries.splice(0);
            captable.cells.splice(0);
            captable.attributes.splice(0);

            results[0].forEach(function(ledger_entry) {
                captable.ledger_entries.push(ledger_entry);
            });
            results[1].forEach(function(raw_transaction) {
                captable.transactions.push(parseTransaction(raw_transaction));
            });
            results[2].forEach(function(raw_name) {
                captable.investors.push(rowFromName(raw_name));
            });
            results[3].forEach(function(attr) {
                captable.attributes.push(attr);
            });

            fireTourModal(captable.transactions);
            attachEvidence(results[4]);

            generateCells();
            generateGrantCells();

            linkUsers(captable.investors, results[5], results[6]);
            sortSecurities(captable.securities);
            sortInvestors(captable.investors);
        }, logError).finally(function() {
            loadInProgress = false;
        });
        console.log(captable);
    }
    loadCapTable();
    this.forceRefresh = function() {
        if (!loadInProgress) {
            loadCapTable();
        }
    };

    /* Data Gathering Functions */

    function loadEvidence() {
        var promise = $q.defer();
        if (role() == 'issuer') {
            SWBrijj.tblm('ownership.my_company_evidence')
            .then(function(evidence) {
                promise.resolve(evidence);
            }).except(logError);
        } else {
            promise.resolve([]);
        }
        return promise.promise;
    }
    function loadRowNames() {
        var promise = $q.defer();
        SWBrijj.tblm(role() == 'issuer'
                        ? '_ownership.my_company_row_names'
                        : '_ownership.my_investor_row_names')
        .then(function(names) {
            promise.resolve(names);
        }).except(logError);
        return promise.promise;
    }
    function fireTourModal(trans) {
        if (Object.keys(trans).length === 0 &&
            Modernizr.testProp('pointerEvents'))
        {
            $rootScope.$on('billingLoaded', function(x) {
                initUI();
            });
            initUI();
        }
    }
    function loadLedger() {
        var promise = $q.defer();
        SWBrijj.tblm(role() == 'issuer' ? '_ownership.my_company_ledger'
                                      : '_ownership.my_investor_ledger')
        .then(function(entries) {
            promise.resolve(entries);
        }).except(logError);
        return promise.promise;
    }
    function loadTransactionLog() {
        var promise = $q.defer();
        SWBrijj.tblm(role() == 'issuer' ? '_ownership.my_company_draft_transactions'
                                      : '_ownership.my_investor_draft_transactions')
        .then(function(trans) {
            promise.resolve(trans);
        }).except(logError);
        return promise.promise;
    }

    function loadActivity() {
        var promise = $q.defer();
        if (role() == 'issuer') {
            SWBrijj.procm('ownership.get_company_activity')
                .then(function(activity) {
                    promise.resolve(activity);
                }).except(logError);
        } else {
            promise.resolve([]);
        }
        return promise.promise;
    }

    function loadLogins() {
        var promise = $q.defer();
        SWBrijj.tblm('ownership.user_tracker')
            .then(function(logins) {
                promise.resolve(logins);
            }).except(logError);
        return promise.promise;
    }

    // TODO refactor to use attributes service
    function loadAttributes() {
        var promise = $q.defer();
        SWBrijj.tblm('_ownership.transaction_attributes',
                     ['name', 'display_name'])
        .then(function(attrs) {
            promise.resolve(attrs);
        }).except(logError);
        return promise.promise;
    }

    /* Cap Table Constructor Functions
     *
     * Based on the type of each transaction,
     * generate the relevant data types.
     *
     * For example:
     * -  generate securities from 'issue security' transactions
     */
    var transactionParser = {"issue security": parseIssueSecurity,
                             "retire security": parseRetireSecurity,
                             "purchase": parsePurchase,
                             "repurchase": parseRepurchase,
                             "transfer": parseTransfer,
                             "convert": parseConvert,
                             "split": parseSplit,
                             "grant": parseGrant,
                             "exercise": parseExercise,
                             "forfeit": parseForfeit
                             };
    function parseTransaction(tran) {
        tran.attrs = JSON.parse(tran.attrs);
        for (var a in tran.attrs)
        {//TODO this loop is to get rid of bad data. Hopefully it should only be temporary and unneccessary for the final/deployed version
            if (tran.attrs[a] && attrs[tran.attrs.security_type] &&
                attrs[tran.attrs.security_type][tran.kind] &&
                attrs[tran.attrs.security_type][tran.kind][a] &&
                attrs[tran.attrs.security_type][tran.kind][a].type == "number")
            {
                tran.attrs[a] = Number(tran.attrs[a]);
            }
        }
        if (tran.kind in transactionParser) {
            transactionParser[tran.kind](tran);
        }
        tran.valid = validateTransaction(tran);
        return tran;
    }
    /* parseIssueSecurity
     *
     * Securities retain a summary of their transactions
     * as attributes on the security object iself.
     *
     * Therefore, any transactions affecting this summary must be
     * parsed to incorporate such relevant data in the summary.
     *
     */
    function parseIssueSecurity(tran) {
        var security = nullSecurity();
        security.new_name = security.name = tran.attrs.security;
        security.effective_date = tran.effective_date;
        security.insertion_date = tran.insertion_date;
        security.transactions.push(tran);
        security.attrs = tran.attrs;

        captable.securities.push(security);
    }
    function parseRetireSecurity(tran) {
        var sec = securityFor(tran);
        if (sec && sec.transactions) sec.transactions.push(tran);
    }
    function parsePurchase(tran) {
    }
    function parseRepurchase(tran) {
    }
    function parseTransfer(tran) {
    }
    function parseConvert(tran) {
        var sec = securityFor(tran);
        if (sec && sec.transactions) sec.transactions.push(tran);
    }
    function parseSplit(tran) {
        var sec = securityFor(tran);
        if (sec && sec.transactions) sec.transactions.push(tran);
    }
    function parseGrant(tran) {
    }
    function parseExercise(tran) {
    }
    function parseForfeit(tran) {
    }
    function visibleInvestors() {
        return captable.cells
            .filter(function(el) {
                return true;})
            .reduce(accumulateProperty('investor'), []);
    }
    function visibleSecurities() {
        return captable.cells
            .filter(function(el) {
                return el.security !== "";})
            .reduce(accumulateProperty('security'), []);
    }
    function numUnissued(sec, securities) {
        var unissued = 0;
        var auth_securities = [];
        angular.forEach(captable.securities, function(sec) {
            if (sec && sec.attrs && calculate.primaryMeasure(
                sec.attrs.security_type) == "units" && sec.attrs.totalauth && sec.attrs.totalauth.toString().length > 0)
            {
                auth_securities.push(sec.name);
            }
        });
        var entry_filter = function(el) {
            return el && (el.investor || auth_securities.indexOf(el.security) !== -1);
        };
        angular.forEach(captable.ledger_entries.filter(entry_filter), function(entry) {
            if ((!entry.investor) && (entry.security == sec.name))
            {
                unissued += (Number(entry.credit) - Number(entry.debit));
            }
        });
        return unissued;
    }
    this.numUnissued = numUnissued;
    function selectedCellHistory() {
        var watches = Object.keys(History.history);
        var obj = History.history[watches[0]];
        var hist = obj.selectedCell;
        return hist;
    }
    this.selectedCellHistory = selectedCellHistory;
    function securityFor(obj) {
        return captable.securities.filter(function(el) {
            return el.name == obj.attrs.security;
        })[0];
    }
    function cellFor(inv, sec, create) {
        var cells = captable.cells
            .filter(function(cell) {
                return cell.investor == inv &&
                       cell.security == sec &&
                       (cell.a || cell.u || (cell.transactions.length > 1));
            });
        if (cells.length === 0 && create) {
            return createCell(inv, sec);
        } else if (cells.length == 1) {
            return cells[0];
        } else if (cells.length > 1) {
            // FIXME error, do cleanup?
            // There should never be 2 cells with the same inv and sec.
            return null;
        } else {
            return null;
        }
    }
    this.cellFor = cellFor;
    function grantCellFor(grant, kind, create) {
        var cells = captable.grantCells
            .filter(function(c) {
                return c.root.transaction == grant &&
                       c.kind == kind &&
                       (c.u || c.transactions.length > 1);
            });
        //console.log("cellFor", grant, kind, create, cells.length);
        if (cells.length === 0 && create) {
            return createGrantCell(grant, kind);
        } else if (cells.length == 1) {
            return cells[0];
        } else if (cells.length > 1) {
            // FIXME error, do cleanup?
            // There should never be 2 cells with the same inv and sec.
            return null;
        } else {
            return null;
        }
    }
    this.grantCellFor = grantCellFor;
    function grantRowInfoFor(sec) {
        var trans = captable.ledger_entries.filter(function(ent) {
            return ent.security == sec;
        }).reduce(accumulateProperty('transaction'), []);
        var res = captable.transactions.filter(function(tran) {
            return trans.indexOf(tran.transaction) != -1 && tran.kind == 'grant';
        });
        /*var grants = captable.grantCells.filter(function(c) {
                return c.kind == 'granted' && c.root.attrs.security == sec;
            });*/
        /*var rows = [];
        angular.forEach(res, function(tran) {
            var row = {};
            row.investor = tran.attrs.investor;
            row.grant = tran.transaction;
            rows.push(row);
        });*/
        return res;
    }
    this.grantRowInfoFor = grantRowInfoFor;
    this.rowSum = function(inv) {
        return rowFor(inv)
            .reduce(function(prev, cur, idx, arr) {
                return prev + (calculate.isNumber(cur.u) ? cur.u : 0);
            }, 0);
    };
    this.investorsIn = function(sec) {
        var names = captable.ledger_entries.filter(function(ent) {
            return ent.security == sec.name;
        }).reduce(accumulateProperty('investor'), []);
        var res = captable.investors.filter(function(inv) {
            return names.indexOf(inv.name) != -1;
        });
        return res;
    };
    this.grantsOf = function(sec) {
        var trans = captable.transactions.filter(function(tran) {
            return tran.kind == 'grant' && tran.attrs.security == sec.name;
        });
        return trans;
    };
    function cellsForLedger(entries) {
        var checked = {};
        var cells = [];
        for (var e in entries)
        {
            if (entries[e].security && entries[e].investor)
            {
                if (!checked[entries[e].security])
                    checked[entries[e].security] = {};
                if (!checked[entries[e].security][entries[e].investor])
                {
                    cells.push(cellFor(entries[e].investor,
                                       entries[e].security,
                                       true));
                    checked[entries[e].security][entries[e].investor] = true;
                }
            }
        }
        return cells;
    }
    function cellsForTran(tran) {
        var invs = [];
        var secs = [];
        for (var a in tran.attrs)
        {
            if (a.indexOf('investor') != -1)
            {
                invs.push(a);
            }
            if (a.indexOf('security') != -1 && a.indexOf('type') == -1)
            {
                secs.push(a);
            }
        }
        return captable.cells.filter(function(cell) {
            var inv = false;
            var sec = false;
            for (var a in invs)
            {
                if (tran.attrs[invs[a]] == cell.investor)
                {
                    inv = true;
                    break;
                }
            }
            for (a in secs)
            {
                if (tran.attrs[secs[a]] == cell.security)
                {
                    sec = true;
                    break;
                }
            }
            return (inv || (invs.length === 0 && tran.kind != 'issue security')) && sec;
        });
    }
    function transForCell(inv, sec) {
        // Investor identifying attributes
        var invs = $filter('getInvestorAttributes')();
        // Security identifying attributes
        var secs = $filter('getSecurityAttributes')();

        var trans = captable.transactions.filter(
            function(tran) {
                // Some transactions do not carry underlier data,
                // so we must get it from the security object,
                var security = securityFor(tran);
                var investor_matches = false;
                var security_matches = false;
                var has_investor_attribute = false;

                for (var a in invs)
                {
                    if (tran.attrs[invs[a]])
                    {
                        has_investor_attribute = true;
                    }
                    if (tran.attrs[invs[a]] == inv)
                    {
                        investor_matches = true;
                        break;
                    }
                }
                for (a in secs)
                {
                    if (tran.attrs[secs[a]] == sec ||
                        (tran.kind == 'exercise' &&
                         security.attrs[secs[a]] == sec))
                    {
                        security_matches = true;
                        break;
                    }

                }
                return (investor_matches ||
                        (!has_investor_attribute &&
                         tran.kind != 'issue security')
                        ) &&
                       security_matches;
            });
        return trans;
    }
    function secHasUnissued(securities) {
        return function(sec) {
            return numUnissued(sec, securities);
        };
    }
    this.securitiesWithUnissuedUnits = function() {
        return captable.securities.filter(secHasUnissued(captable.securities));
    };
    this.securityUnissuedPercentage = function(sec, securities) {
        return 100 * (numUnissued(sec, securities) / totalOwnershipUnits());
    };
    function rowFor(inv) {
        return captable.cells
            .filter(function(cell) {
                return cell.investor == inv;
            });
    }
    this.rowFor = rowFor;
    function colFor(sec) {
        return captable.cells
            .filter(function(cell) {
                return cell.security == sec;
            });
    }
    function transForInv(inv) {
        return captable.transactions
            .filter(function(tran) {
                for (var k in tran.attrs)
                {
                    if (k.indexOf('investor') != -1)
                    {
                        if (tran.attrs[k] == inv)
                            return true;
                    }
                }
                return false;
            });
    }
    this.transForInv = transForInv;
    function transForSec(sec) {
        return captable.transactions
            .filter(function(tran) {
                for (var k in tran.attrs)
                {
                    if (k.indexOf('security') != -1)
                    {
                        if (tran.attrs[k] == sec)
                            return true;
                    }
                }
                return false;
            });
    }
    this.transForSec = transForSec;
    this.updateInvestorName = function(investor) {
        SWBrijj.procm('_ownership.rename_investor', investor.name, investor.new_name).then(function (data) {
            var cells = rowFor(investor.name);
            for (var c in cells)
            {
                cells[c].investor = investor.new_name;
            }
            var trans = transForInv(investor.name);
            for (var t in trans)
            {
                for (var a in trans[t].attrs)
                {
                    if (a.indexOf('investor') != -1)
                    {
                        if (trans[t].attrs[a] == investor.name)
                        {
                            trans[t].attrs[a] = investor.new_name;
                        }
                    }
                }
                saveTransaction(trans[t], true);
            }
            investor.name = investor.new_name;
        }).except(function(x) {
            console.log(x);
        });
    };
    this.updateSecurityName = function(security) {
        if (captable.securities.some(function(sec) {
            return (sec.name === security.new_name);
        })) {
            // duplicated security name
            security.new_name = security.new_name + " (1)";
            return this.updateSecurityName(security);
        }
        var cells = colFor(security.name);
        for (var c in cells)
        {
            cells[c].security = security.new_name;
        }
        var trans = transForSec(security.name);
        for (var t in trans)
        {
            for (var a in trans[t].attrs)
            {
                if (a.indexOf('security') != -1)
                {
                    if (trans[t].attrs[a] == security.name)
                    {
                        trans[t].attrs[a] = security.new_name;
                    }
                }
            }
            saveTransaction(trans[t], true);
        }
        security.name = security.new_name;
    };
    function cellPrimaryMeasure(cell) {
        return calculate.primaryMeasure( cellSecurityType(cell) );
    }
    function cellSecurityType(cell) {
        if (cell && cell.security) {
            return captable.securities
                .filter(function(el) {
                    return el && el.name == cell.security && el.attrs;
                })[0].attrs.security_type;
        }
    }
    this.cellSecurityType = cellSecurityType;
    function setCellUnits(cell) {
        if (!cell) return;
        if (cellPrimaryMeasure(cell) == "units") {
            cell.u = sum_ledger(cell.ledger_entries);
        }
    }
    this.setCellUnits = setCellUnits;
    function setCellAmount(cell) {
        if (!cell) return;
        if (cellPrimaryMeasure(cell) == "amount") {
            cell.a = sum_ledger(cell.ledger_entries);
        } else if (cellSecurityType(cell) == "Option") {
            return;
        } else {
            var transactionkeys = [];
            angular.forEach(cell.transactions, function(tran) {
                transactionkeys.push(tran.transaction);
            });
            var plus_trans = cell.transactions
                .filter(function(el) {
                    return (el.attrs.investor == cell.investor && (transactionkeys.indexOf(el.attrs.transaction_from) == -1) &&
                            el.kind != 'repurchase') ||
                           el.attrs.investor_to == cell.investor;});
            var minus_trans = cell.transactions
                .filter(function(el) {
                    return el.attrs.investor_from == cell.investor ;
                });
            cell.a = sum_transactions(plus_trans) - sum_transactions(minus_trans);
        }
    }
    this.setCellAmount = setCellAmount;
    function sum_ledger(entries) {
        return entries.reduce(
                function(prev, cur, index, arr) {
                   return prev + (cur.credit - cur.debit);
                }, 0);
    }
    function sum_transactions(trans) {
        return trans.reduce(sumTransactionAmount, 0);
    }
    this.sum_transactions = sum_transactions;

    function cleanCell(cell) {
        var sec_obj = captable.securities
            .filter(function(el) {
                return el.name==cell.security && el.attrs.security_type;
            })[0];
        var defaultTran = newTransaction(cell.security, defaultKind(sec_obj.attrs.security_type), cell.investor);
        for (var t in cell.transactions)
        {
            if (!cell.transactions[t].transaction)
                break;
            var del = true;
            for (var a in cell.transactions[t].attrs)
            {
                if (cell.transactions[t].attrs[a] && (cell.transactions[t].attrs[a] != defaultTran.attrs[a]))
                {
                    del = false;
                    break;
                }
            }
            if (del)
            {
                console.log("deleting tran", cell.transactions[t].transaction, cell.investor, cell.security);
                deleteTransaction(cell.transactions[t], cell, true);
            }
        }
    }

    function updateCell(cell) {
        cell.ledger_entries = cell.transactions = null;
        cell.a = cell.u = null;

        cell.transactions = transForCell(cell.investor, cell.security);
        cell.ledger_entries = captable.ledger_entries.filter(
            function(ent) {
                return ent.investor == cell.investor &&
                       ent.security == cell.security;
            });
        setCellUnits(cell);
        setCellAmount(cell);
        cell.valid = validateCell(cell);
        cleanCell(cell);
    }
    this.updateCell = updateCell;
    function generateCells() {
        angular.forEach(captable.investors, function(inv) {
            angular.forEach(captable.securities, function(sec) {
                var transactions = transForCell(inv.name, sec.name);
                if (transactions.length > 0) {
                    var cell = nullCell();
                    cell.transactions = transactions;
                    cell.ledger_entries = captable.ledger_entries.filter(
                        function(ent) {
                            return ent.investor == inv.name &&
                                   ent.security == sec.name;
                        });
                    cell.security = sec.name;
                    cell.investor = inv.name;
                    setCellUnits(cell);
                    setCellAmount(cell);
                    cell.valid = validateCell(cell);
                    captable.cells.push(cell);
                }
            });
            // NOTE: this is a fn as a property b/c it makes sorting easy
            inv.percentage = function() {
                return investorSorting(inv.name);
            };
        });
    }
    function generateGrantCells() {
        /* Each grant cell has a list of root transactions.
         *
         * From those transactions and the cell kind we get
         * the list of ledger entries.
         *
         * The trick is to find the root transactions.
         *
         */
        var grants = captable.transactions
            .filter(function(tran) { return tran.kind == 'grant'; });
        angular.forEach(grants, function(g) {
            var root = g;
            angular.forEach(grantColumns, function(col) {
                var cell = nullGrantCell();
                cell.root = root;
                cell.kind = col.name;
                cell.investor = root.attrs.investor;
                cell.security = root.attrs.security;
                cell.transactions = captable.transactions
                    .filter(col.tranFilter(root));
                var tran_ids = cell.transactions
                    .reduce(accumulateProperty('transaction'), []);
                cell.ledger_entries = captable.ledger_entries
                    .filter(col.ledgerFilter(tran_ids));
                setCellUnits(cell);
                captable.grantCells.push(cell);
            });
        });
    }

    function linkUsers(investors, activities, logins) {
        angular.forEach(investors, function(investor) {
            angular.forEach(activities, function(activity) {
                if (activity.email == investor.email) {
                    var act = activity.activity;
                    var time = activity.event_time;
                    investor[act] = time;
                }
            });
            angular.forEach(logins, function (login) {
                if (login.email == investor.email) {
                    investor.lastlogin = login.logintime;
                }
            });
        });
    }

    function sortSecurities(securities) {
        return securities.sort(securitySort);
    }

    function sortInvestors(investors) {
        return investors.sort(percentageSort);
    }

    function securitySort(a,b) {
        if (a.effective_date < b.effective_date)
            return -1;
        if (a.effective_date > b.effective_date)
            return 1;
        if (a.effective_date == b.effective_date) {
            if (a.insertion_date < b.insertion_date)
                return -1;
            if (a.insertion_date > b.insertion_date)
                return 1;
        }
        return 0;
    }

    function percentageSort(a,b) {
        if (a.percentage() > b.percentage())
            return -1;
        if (a.percentage() < b.percentage())
            return 1;
        return 0;
    }

    function investorSorting(inv) {
        if (inv === "") { return -100; } // keep new inv rows at bottom
        return investorOwnershipPercentage(inv);
    }
    function splice_many(array, elements) {
        var indices = elements
            .map(function(el) {return array.indexOf(el);})
            .filter(function(el) {return el!==-1;});
        indices.sort(function(a, b){return b-a;});//descending order so splice won't affect later indices
        return indices.map(function(idx) {return array.splice(idx, 1);});
    }
    function splice_many_by(array, filter_fn) {
        return splice_many(array, array.filter(filter_fn));
    }
    /* saveTransaction
     *
     * Takes a new (no id) transaction or an instance of an
     * existing transaction which we assume to have been modified.
     *
     * Send transaction to the database (_ownership.save_transaction).
     *
     * Database fn will...
     * -  upsert transaction into _ownership.draft_transactions
     * -  remove existing ledger entries, if any exist
     * -  parse transaction into ledger entries, and insert them
     * -  return new ledger entries to front-end
     *
     * This fn then updates the captable object with
     * the new ledger entries.
     *
     */
    function saveTransaction(tran, update, errorFunc) {
        // TODO this is getting called too often.
        // use ng-change instead of ui-event?
        //
        // or maybe add a save button for now
        // TODO: return a promise instead of having errorFunc
        for (var key in tran.attrs) {
            if (tran.attrs[key] === null) {
                delete tran.attrs[key];
            }
        }
        SWBrijj.procm('_ownership.save_transaction',
                      JSON.stringify(tran))
        .then(function(new_entries) {
            if (new_entries.length < 1)
            {
                console.log("Error: no ledger entries");
                return;
            }
            var transaction = new_entries.splice(0, 1)[0].transaction;
            //console.log("new ledger", new_entries.length, new_entries, JSON.stringify(tran));
            var spliced = [];
            for (var new_entry in new_entries)
            {
                if (spliced.indexOf(new_entries[new_entry].transaction) == -1)
                {
                    spliced.push(new_entries[new_entry].transaction);
                    splice_many_by(captable.ledger_entries, function(el) {
                            return el.transaction == new_entries[new_entry].transaction;
                    });
                }
                captable.ledger_entries.push(new_entries[new_entry]);
            }
            var found = false;
            for (var i in captable.transactions)
            {
                if (captable.transactions[i].transaction == tran.transaction)
                {
                    if (tran.transaction == null)
                    {
                        if ((captable.transactions[i].attrs.investor == tran.attrs.investor) &&
                            (captable.transactions[i].attrs.security == tran.attrs.security))
                        {//just in case multiple null transactions
                            captable.transactions[i].transaction = transaction;
                            captable.transactions[i].valid = validateTransaction(tran);
                            found = true;
                        }
                    }
                    else
                    {
                        captable.transactions[i].transaction = transaction;
                        captable.transactions[i].valid = validateTransaction(tran);
                        found = true;
                    }
                }
            }
            tran.transaction = transaction;
            if (!found)
            {
                tran.valid = validateTransaction(tran);
                captable.transactions.push(tran);
            }
            if (update)
            {
                var cells = cellsForLedger(new_entries);
                for (var c in cells)
                {
                    updateCell(cells[c]);
                }
            }
            //captable.ledger_entries.push.apply(captable., new_entries);
            //console.log(captable.ledger_entries.filter(function(el) {return el.transaction==tran.transaction;}));
        }).except(function(e) {
            console.log("error");
            console.error(e);
            if (errorFunc)
            {
                errorFunc();
            }
        });
    }
    this.saveTransaction = saveTransaction;

    function deleteTransaction(tran, cell, hide) {
        if (tran.transaction) {
            SWBrijj.procm('_ownership.delete_transaction', tran.transaction)
            .then(function(x) {
                var res = x[0].delete_transaction;
                if (res > 0) {
                    if (!hide)
                    {
                        $rootScope.$emit("notification:success",
                            "Transaction deleted");
                    }
                    splice_many(captable.transactions, [tran]);
                    splice_many_by(captable.ledger_entries, function(el) {
                            return el.transaction == tran.transaction;
                    });
                    if (cell.transactions.length == 1)
                    {
                        splice_many(captable.cells, [cell]);
                        cell = null;
                    }
                    else
                    {
                        var cells = cellsForTran(tran);
                        for (var c in cells)
                        {
                            updateCell(cells[c]);
                        }
                    }
                } else {
                    if (!hide)
                    {
                        $rootScope.$emit("notification:fail",
                            "Oops, something went wrong.");
                    }
                }
            }).except(function(err) {
                console.error(err);
                if (!hide)
                {
                    $rootScope.$emit("notification:fail",
                        "Oops, something went wrong.");
                }
            });
        } else {
            splice_many(captable.transactions, [tran]);
            if (cell.transactions.length == 1)
            {
                splice_many(captable.cells, [cell]);
                cell = null;
            }
            else
            {
                var cells = cellsForTran(tran);
                for (var c in cells)
                {
                    updateCell(cells[c]);
                }
            }
        }
    }
    this.deleteTransaction = deleteTransaction;
    this.deleteSecurityTransaction = function(tran, sec) {
        SWBrijj.procm('_ownership.delete_transaction', tran.transaction)
        .then(function(x) {
            var res = x[0].delete_transaction;
            if (res > 0) {
                $rootScope.$emit("notification:success",
                    "Transaction deleted");
                splice_many(captable.transactions, [tran]);
                splice_many_by(captable.ledger_entries, function(el) {
                        return el.transaction == tran.transaction;
                });
                splice_many(sec.transactions, [tran]);
                var cells = colFor(sec.name);
                for (var c in cells)
                {
                    updateCell(cells[c]);
                }
            } else {
                $rootScope.$emit("notification:fail",
                    "Oops, something went wrong.");
            }
        }).except(function(err) {
            console.log(err);
            $rootScope.$emit("notification:fail",
                "Oops, something went wrong.");
        });
    };
    this.deleteSecurity = function(sec) {
        SWBrijj.procm('_ownership.delete_security', sec.name)
        .then(function(x) {
            var res = x[0].delete_security;
            if (res > 0) {
                $rootScope.$emit("notification:success",
                    "Security deleted");
                $rootScope.$broadcast("deleteSecurity");

                var idx = captable.securities.indexOf(sec);
                if (idx !== -1) { captable.securities.splice(idx, 1); }
                splice_many_by(captable.cells,
                    function(el) {return el.security==sec.name;});
                splice_many(captable.transactions, sec.transactions);

            } else {
                $rootScope.$emit("notification:fail",
                    "Oops, something went wrong.");
            }
        }).except(function(err) {
            console.log(err);
            $rootScope.$emit("notification:fail",
                "Oops, something went wrong.");
        });
    };
    this.removeInvestor = function(inv) {
        SWBrijj.procm('_ownership.remove_investor', inv.name)
        .then(function(x) {
            var res = x[0].remove_investor;
            if (res > 0) {
                $rootScope.$emit("notification:success",
                    "Investor removed from captable.");

                var idx = captable.investors.indexOf(inv);
                if (idx !== -1) { captable.investors.splice(idx, 1); }
                splice_many_by(captable.cells,
                    function(el) {return el.investor==inv.name;});
                splice_many(captable.transactions, inv.transactions);
            } else {
                $rootScope.$emit("notification:fail",
                    "Sorry, We were unable to remove this investor.");
            }
        }).except(function(err) {
            console.log(err);
            $rootScope.$emit("notification:fail",
                "Oops, something went wrong.");
        });
    };
    function rowFromName(name) {
        var row = new Investor();
        row.new_name = row.name = name.name;
        row.email = name.email;
        row.access_level = name.level;
        row.transactions = captable.transactions
            .filter(function(el) {
                return (row.name && el.attrs.investor == row.name) ||
                       (row.email && el.attrs.investor == row.email);
            });
        return row;
    }
    function initUI() {
        $rootScope.$broadcast('captable:initui');
    }
    function attachEvidence(data) {
        angular.forEach(captable.transactions, function(tran) {
            tran.evidence_data = data.filter(function(el) {
                return el.evidence==tran.evidence;
            });
            if (tran.evidence_data.length > 0) {
                console.log("evidence!", tran);
            }
        });
    }
    function reformatDate(obj) {
        obj.date = calculate.timezoneOffset(obj.date);
    }
    function setVestingDates(obj) {
        if (obj.vestingbegins) {
            obj.vestingbegins =
                calculate.timezoneOffset(obj.vestingbegins);
            obj.vestingbeginsdisplay =
                calculate.monthDiff(obj.vestingbegins, obj.date);
        }
    }
    function processIssue(iss) {
        setIssueKey(iss);
        reformatDate(iss);
        setVestingDates(iss);
    }
    function logError(err) { console.log(err); }
    function nullCell() {
        return new Cell();
    }
    this.nullCell = nullCell;
    function nullGrantCell() {
        return new GrantCell();
    }
    function newCell(issue) {
        var cell = new Cell();
        cell.issue_type = issue.type;
        return cell;
    }
    this.newCell = newCell;
    function nullIssue() {
        return new Issue();
    }
    this.nullIssue = nullIssue;
    function nullSecurity() {
        return new Security();
    }
    /* initAttrs
     *
     * Grab valid attribute keys from the attributes service
     * for the given security type and transaction kind.
     *
     * Add said keys to obj.attrs
     */
    function initAttrs(obj, sec_type, kind) {
        var attr_obj = attrs[sec_type][kind];
        if (attr_obj) {
            angular.forEach(Object.keys(attr_obj),
                    function(el) { obj.attrs[el] = null; });
            if ((attr_obj.hasOwnProperty('physical')) && (obj.attrs.physical == null))
            {
                obj.attrs.physical = false;
            }
        }
    }

    function newTransaction(sec, kind, inv) {
        var tran = new Transaction();
        tran.kind = kind;
        tran.company = $rootScope.navState.company;
        tran.insertion_date = new Date(Date.now());
        tran.effective_date = new Date(Date.now());
        var sec_obj = captable.securities
            .filter(function(el) {
                return el.name==sec && el.attrs.security_type;
            })[0];
        initAttrs(tran, sec_obj.attrs.security_type, kind);
        tran.attrs.security = sec;
        tran.attrs.security_type = sec_obj.attrs.security_type;
        angular.forEach(tran.attrs, function(value, key) {
            if (sec_obj.attrs[key]) tran.attrs[key] = sec_obj.attrs[key];
        });
        if (tran.attrs.hasOwnProperty('investor'))
        {
            tran.attrs.investor = inv;
        }
        if (tran.attrs.hasOwnProperty('investor_from'))
        {
            tran.attrs.investor_from = inv;
        }
        return tran;
    }
    this.newTransaction = newTransaction;
    this.newSecurity = function() {
        var security = nullSecurity();
        security.newName = security.name = "";
        security.effective_date = new Date(Date.now());
        security.insertion_date = new Date(Date.now());
        initAttrs(security, 'Option', 'issue security');
        security.attrs.security = security.name;
        security.attrs.security_type = 'Option';
        security.creating = true;

        var tran = new Transaction();
        tran.kind = 'issue security';
        tran.company = $rootScope.navState.company;
        tran.attrs = security.attrs;
        // Silly future date so that the issue always appears
        // on the leftmost side of the table
        tran.insertion_date = new Date(2100, 1, 1);

        security.transactions.push(tran);
        return security;
    };
    this.addSecurity = function(security) {
        // NOTE assume Option for now, user can change,
        //var tran = newTransaction("Option", "issue security");
        //tran.kind = "issue_security";
        var tran = security.transactions[0]; //the transaction that was edited

        if (captable.securities.some(function(sec) {
            return (sec.name === tran.attrs.security);
        })) {
            // duplicated security name
            tran.attrs.security = tran.attrs.security + " (1)";
            return this.addSecurity(security);
        }
        console.log("addSecurity");

        security.new_name = security.name = tran.attrs.security;
        security.effective_date = tran.effective_date;
        security.insertion_date = tran.insertion_date;
        security.attrs = tran.attrs;
        console.log(security.attrs);

        // FIXME should we be using AddTran
        // which takes care of the ledger entries?
        captable.transactions.push(tran);
        security.creating = false;
        captable.securities.push(security);
        saveTransaction(tran);
    };
    this.addInvestor = function(name) {
        var inv = new Investor();
        inv.editable = true;
        inv.new_name = inv.name = name;
        inv.company = $rootScope.navState.company;
        inv.percentage = function() {return investorSorting(inv.name);};
        SWBrijj.procm('_ownership.add_investor', inv.name)
        .then(function(x) {
            captable.investors.push(inv);
        }).except(function(err) {
            console.log(err);
        });
    };
    this.addTransaction = function(inv, sec, kind) {
        var tran = newTransaction(sec, kind, inv);
        captable.transactions.push(tran);
        updateCell(this.cellFor(inv, sec, true));
        return tran;
    };
    function defaultKind(sec) {
        var options = Object.keys(attrs[sec]);
        if (options.indexOf('grant') != -1)
            return 'grant';
        if (options.indexOf('purchase') != -1)
            return 'purchase';
        if (options.length == 1)
            return options[0];
        if (options.length === 0)
            return null;
        if (options.indexOf('issue security') === 0)
            return options[1];
        return options[0];
    }
    this.defaultKind = defaultKind;
    function createCell(inv, sec) {
        var c = new Cell();
        c.investor = inv;
        c.security = sec;
        var sec_obj = captable.securities
            .filter(function(el) { return el.name==sec; })[0];
        if (!sec_obj.attrs || !sec_obj.attrs.security_type) {
            return null;
        } else {
            var tran = newTransaction(sec, defaultKind(sec_obj.attrs.security_type), inv);
            tran.active = true;
            c.transactions.push(tran);
            captable.cells.push(c);
            return c;
        }
    }
    this.createCell = createCell;
    function createGrantCell(grant, kind) {
        var root = captable.transactions
            .filter(function(tran) {
                return tran.transaction == grant;
            });
        console.log("grant", grant, root, root.length);
        root = root[0];
        var c = new GrantCell();
        c.root = root;
        c.investor = root.attrs.investor;
        c.security = root.attrs.security;
        c.kind = kind;
        var sec_obj = captable.securities
            .filter(function(el) {
                return el.name == root.attrs.security;
            })[0];
        if (!sec_obj.attrs || !sec_obj.attrs.security_Type) {
            return null;
        } else {
            // TODO
        }
    }
    this.createGrantCell = createGrantCell;
    function attachPariPassu(securities, links) {
        angular.forEach(securities, function(iss) {
            iss.paripassu = [];
            angular.forEach(links, function(link) {
                if (link.issue == iss.issue) {
                    iss.paripassu.push(link);
                }
            });
            if (iss.paripassu.length === 0) {
                iss.paripassu.push({"company": iss.company,
                                    "issue": iss.issue,
                                    "pariwith": null});
            }
        });
    }

    function secHasTran(name)
    {
        for (var t in captable.transactions)
        {
            if (captable.transactions[t].attrs.security == name &&
                    captable.transactions[t].kind != "issue security")
                return true;
        }
        return false;
    }
    this.secLocked = function(sec) {
        return secHasTran(sec.name);
    };
    /*
     * Sum all ledger entries associated with equity.
     *
     * Sum all ledger entries associated with derivatives.
     *
     * Sum all ledger entries associated with warrants
     * and convertible debt.
     *
     * TODO incorporate effective date (now vs infinity)
     */
    function totalOwnershipUnits(dilution) {
        if (!dilution) dilution = 1;
        var entry_filter;
        var ok_securities = [];
        var auth_securities = [];
        if (dilution <= 0) {
            var ok_types = ["Equity Common",
                            "Equity Preferred",
                            "Options"];
            angular.forEach(captable.securities, function(sec) {
                if (sec && sec.attrs && ok_types.indexOf(
                                    sec.attrs.security_type) !== -1)
                {
                    ok_securities.push(sec.name);
                }
            });
            entry_filter = function(el) {
                return ok_securities.indexOf(el.security) !== -1;
            };
        } else if (dilution == 1) {
            ok_securities = [];
            auth_securities = [];
            angular.forEach(captable.securities, function(sec) {
                if (sec && sec.attrs && calculate.primaryMeasure(
                               sec.attrs.security_type) == "units")
                {
                    ok_securities.push(sec.name);
                }
            });
            angular.forEach(captable.securities, function(sec) {
                if (sec && sec.attrs && calculate.primaryMeasure(
                    sec.attrs.security_type) == "units" && sec.attrs.totalauth && sec.attrs.totalauth.toString().length > 0)
                {
                    auth_securities.push(sec.name);
                }
            });
            entry_filter = function(el) {
                return el && ok_securities.indexOf(el.security) !== -1 && (el.investor || auth_securities.indexOf(el.security) !== -1);
            };
        } else if (dilution >= 2) {
            console.log("TODO",
                "implement dilution scenarios involving conversion");
            return totalOwnershipUnits(1);
        }
        var res = sum_ledger(captable.ledger_entries.filter(entry_filter));
        return res;
    }
    this.totalOwnershipUnits = totalOwnershipUnits;
    function investorOwnershipPercentage(inv) {
        var x = captable.cells
            .filter(function(el) { return el.investor == inv; })
            .reduce(sumCellUnits, 0);
        var res = x / totalOwnershipUnits() * 100;
        return res != Infinity ? res : 0;
    }
    this.investorOwnershipPercentage = investorOwnershipPercentage;
    function securityTotalUnits(sec) {
        if (!sec) return 0;
        return captable.cells
            .filter(function(el) { return el.security == sec.name; })
            .reduce(sumCellUnits, 0);
    }
    this.securityTotalUnits = securityTotalUnits;
    function securityUnitsFrom(sec, kind, inv) {
        if (!(sec && kind)) return 0;

        var trans = captable.transactions.filter(function(tran) {
            // FIXME not working
            /*
            if (tran.kind == kind && kind!='grant' && tran.attrs.security == sec.name) {
                console.log(tran);
            }
            */
            return tran.attrs.security == sec.name &&
                tran.kind == kind;
        }).reduce(accumulateProperty('transaction'), []);

        var entries = captable.ledger_entries.filter(function(ent) {
            return trans.indexOf(ent.transaction) != -1 &&
                (!inv || ent.investor == inv.name);
        });
        return sum_ledger(entries) || 0;
    }
    this.securityUnitsFrom = securityUnitsFrom;
    function unitsFrom(kind) {
        if (!kind) return 0;
        var trans = captable.transactions.filter(function(tran) {
            return tran.kind == kind;
        }).reduce(accumulateProperty('transaction'), []);
        var entries = captable.ledger_entries.filter(function(ent) {
            return trans.indexOf(ent.transaction) != -1;
        });
        return sum_ledger(entries) || 0;
    }
    this.unitsFrom = unitsFrom;
    function accumulateProperty(prop) {
        return function(prev, cur, idx, arr) {
            if (prev.indexOf(cur[prop]) == -1) {
                prev.push(cur[prop]);
            }
            return prev;
        };
    }
    function securityCurrentUnits(sec, inv) {
        if (!sec) return 0;

        var trans = captable.transactions.filter(function(tran) {
            return tran.attrs.security == sec.name;
        }).reduce(accumulateProperty('transaction'), []);

        var entries = captable.ledger_entries.filter(function(ent) {
            return trans.indexOf(ent.transaction) != -1 &&
                ent.investor &&
                (!inv || ent.investor == inv.name) &&
                ent.effective_date <= Date.now();
        });
        return sum_ledger(entries);
    }
    this.securityCurrentUnits = securityCurrentUnits;
    function currentUnits() {
        var trans = captable.transactions.reduce(
                accumulateProperty('transaction'), []);
        var entries = captable.ledger_entries.filter(function(ent) {
            return trans.indexOf(ent.transaction) != -1 &&
                ent.effective_date <= Date.now();
        });
        return sum_ledger(entries);
    }
    this.currentUnits = currentUnits;
    this.securityTotalAmount = function(sec) {
        return captable.cells
            .filter(function(el) { return el.security == sec.name; })
            .reduce(sumCellAmount, 0);
    };
    function sumCellUnits(prev, cur, idx, arr) {
        return prev + (calculate.isNumber(cur.u) ? cur.u : 0);
    }
    function sumCellAmount(prev, cur, idx, arr) {
        return prev + (calculate.isNumber(cur.a) ? cur.a : 0);
    }
    function sumTransactionAmount(prev, cur, idx, arr) {
        return prev + (calculate.isNumber(cur.attrs.amount) ?
                          Number(cur.attrs.amount) : 0);
    }
    function pingIntercomIfCaptableStarted() {
        var earliestedit = new Date.today().addDays(1);
        var duplicate = earliestedit;
        angular.forEach(captable.securities, function(issue) {
            if (issue.created &&
                Date.compare(earliestedit, issue.created) > -1) {
                earliestedit = issue.created;
            }
        });
        if (earliestedit != duplicate) {
            Intercom('update',
                     {company: {'captablestart_at':
                                   parseInt(Date.parse(earliestedit)
                                                .getTime()/1000, 10) } });
        }
    }
    function populateListOfInvestorsWithoutAccessToTheCaptable() {
        var emailedalready = [];
        angular.forEach(captable.investors, function (row) {
            if (row.emailkey !== null) {
                emailedalready.push(row.emailkey);
            }
        });
        // FIXME move to loadCaptable
        SWBrijj.tblm('global.investor_list', ['email', 'name'])
        .then(function(investors) {
            angular.forEach(investors, function(investor, idx) {
                if (emailedalready.indexOf(investor.email) == -1) {
                    var label = (investor.name ? investor.name : "") +
                                "(" + investor.email + ")";
                    captable.vInvestors.push(label);
                }
            });
        });
    }
    var eligible_evidence = [];
    this.getEligibleEvidence = function() {
        return eligible_evidence;
    };
    function loadEligibleEvidence() {
        SWBrijj.tblm('ownership.my_company_eligible_evidence')
        .then(function(data) {
            angular.forEach(data, function(x) {
                if (x.tags) { x.tags = JSON.parse(x.tags); }
                eligible_evidence.push(x);
            });
        }).except(logError);
    }
    if (role() == 'issuer') { loadEligibleEvidence(); }
    function setTransactionEmail(tran) {
        angular.forEach(captable.investors, function (row) {
            if ((row.name == tran.investor) && row.email) {
                tran.email = row.email;
            }
        });
        if (!tran.email) { tran.email = null; }
    }
    this.setTransactionEmail = setTransactionEmail;
    function autocalcThirdTranValue(tran) {
        if (tran.units && tran.amount &&
                tran.ppshare !== 0 && !tran.ppshare) {
            tran.ppshare =
                parseFloat(tran.amount) / parseFloat(tran.units);
        }
        else if (!tran.units && tran.units !== 0 &&
                    tran.amount && tran.ppshare) {
            tran.units =
                parseFloat(tran.amount) / parseFloat(tran.ppshare);
        }
        else if (tran.units && !tran.amount &&
                    tran.amount !== 0 && tran.ppshare) {
            tran.amount =
                parseFloat(tran.units) * parseFloat(tran.ppshare);
        }
    }
    this.autocalcThirdTranValue = autocalcThirdTranValue;
    this.displayAttr = function(key) {
        return captable.attributes.filter(
                function(el) { return el.name==key; })[0].display_name;
    };
    // TODO: move to the security object
    this.isDebt = function(security) {
        if (!security) return;
        return security.attrs.security_type == "Debt" || security.attrs.security_type == "Safe" || security.attrs.security_type == "Convertible Debt";
    };
    this.isOption = function(security) {
        if (!security) return;
        return security.attrs.security_type == "Option";
    };
    function updateEvidenceInDB(obj, action) {
        if (obj.transaction && obj.evidence_data) {
            SWBrijj.procm('_ownership.upsert_transaction_evidence',
                          parseInt(obj.transaction, 10),
                          JSON.stringify(obj.evidence_data)
            ).then(function(r) {
                void(r);
            }).except(function(e) {
                $rootScope.$emit("notification:fail",
                    "Something went wrong. Please try again.");
                console.log(e);
            });
        }
    }
    this.updateEvidenceInDB = updateEvidenceInDB;
    function evidenceEquals(ev1, ev2) {
        return (ev1.doc_id && ev2.doc_id &&
                ev1.doc_id==ev2.doc_id &&
                ev1.investor==ev2.investor)
            || (ev1.original && ev2.original &&
                !ev1.doc_id && !ev2.doc_id &&
                ev1.original==ev2.original);
    }
    this.evidenceEquals = evidenceEquals;
    function addEvidence(ev) {
        if (captable.evidence_object &&
                captable.evidence_object.evidence_data) {
            captable.evidence_object.evidence_data.push(ev);
            console.log(captable.evidence_object.evidence_data)
        }
    }
    this.addEvidence = addEvidence;
    function removeEvidence(ev, obj) {
        if (!obj) {
            captable.evidence_object.evidence_data =
                captable.evidence_object.evidence_data
                    .filter(function(x) {
                        return !evidenceEquals(ev, x);});
            updateEvidenceInDB(captable.evidence_object, 'removed');
        } else {
            obj.evidence_data = obj.evidence_data
                .filter(function(x) {
                    return !evidenceEquals(ev, x);
                });
            updateEvidenceInDB(obj, 'removed');
        }
    }
    this.removeEvidence = removeEvidence;
    this.toggleForEvidence = function(ev) {
        console.log(ev)
        console.log(captable.evidence_object.evidence_data)
        if (!ev || !captable.evidence_object) {return;}
        if (!captable.evidence_object.evidence_data) {
            captable.evidence_object.evidence_data = [];
            console.log(ev);
            console.log(captable);
        } else {
            var action = "";
            if (isEvidence(ev)) {
                removeEvidence(ev);
                action = "removed";
            } else {
                addEvidence(ev);
                action = "added";
                console.log("added!")
            }
            updateEvidenceInDB(captable.evidence_object, action);
        }
    };



    function isEvidence(ev) {
        if (captable.evidence_object &&
                captable.evidence_object.evidence_data) {
            return captable.evidence_object.evidence_data
                .filter(function(x) {
                    return evidenceEquals(ev, x);
                }).length>0;
        } else {
            return false;
            console.log("not added")
        }
    }
    this.isEvidence = isEvidence;

    function validateTransaction(transaction) {
        var correct = true;
        //console.log("validateTransaction");
        if (!attrs)
        {
            console.log("attrs not defined yet");
            return true;
        }
        if (!transaction.attrs.security_type)
        {
            console.log("security_type not defined");
            console.log(transaction);
            return false;
        }
        if (!attrs[transaction.attrs.security_type])
        {
            console.log("wrong security type?");
            console.log(transaction.attrs.security_type);
            console.log(attributes.isLoaded());
            console.log(attrs);
            if (!attributes.isLoaded())
            {//the data could be correct, but the attributes aren't filled in yet
                return true;
            }
            return false;
        }
        for (var att in transaction.attrs)
        {
            if ((transaction.attrs[att]) && (String(transaction.attrs[att]).length > 0))
            {
                if (!attrs[transaction.attrs.security_type] || !attrs[transaction.attrs.security_type][transaction.kind] || !attrs[transaction.attrs.security_type][transaction.kind][att])
                {
                    correct = false;
                    //console.log("Invalid attribute");
                    //console.log(att);
                    return correct;
                }
                if (att.indexOf('security_type') != -1)
                {
                    if (!attrs.hasOwnProperty(transaction.attrs[att]))
                    {
                        correct = false;
                        console.log("invalid security type");
                        console.log(att);
                        return correct;
                    }
                    break;
                }
                switch(attrs[transaction.attrs.security_type][transaction.kind][att].type)
                {
                    case "number":
                        if (!calculate.isNumber(transaction.attrs[att]))
                        {
                            correct = false;
                            console.log("wrong type number");
                            console.log(att);
                            return correct;
                        }
                        break;
                    case "enum":
                        if (attrs[transaction.attrs.security_type][transaction.kind][att].labels.indexOf(transaction.attrs[att]) == -1)
                        {
                            correct = false;
                            console.log("wrong type enum");
                            console.log(att);
                            return correct;
                        }
                        break;
                    case "date":
                        break;
                    default:
                        if ((attrs[transaction.attrs.security_type][transaction.kind][att].type) &&
                            (typeof(transaction.attrs[att]) != attrs[transaction.attrs.security_type][transaction.kind][att].type))
                        {
                            correct = false;
                            console.log("wrong type default");
                            console.log(att);
                            return correct;
                        }
                }
            }
        }
        for (att in attrs[transaction.attrs.security_type][transaction.kind])
        {
            if (attrs[transaction.attrs.security_type][transaction.kind][att].required)
            {
                if (!((transaction.attrs[att] != undefined) && (transaction.attrs[att] != null) &&
                    (String(transaction.attrs[att]).length > 0)))
                {
                    correct = false;
                    console.log("required not filled");
                    console.log(att);
                    return correct;
                }
            }
        }
        return correct;
    }
    this.validateTransaction = validateTransaction;
    function validateCell(cell) {
        console.log("validateCell");
        if (!attrs)
        {
            console.log("attrs not defined");
            return true;
        }
        var correct = true;
        for (var t in cell.transactions)
        {
            correct = correct && (cell.transactions[t].valid || validateTransaction(cell.transactions[t]));
            if (!correct)
                return correct;
        }
        return correct;
    }
    this.validateCell = validateCell;
});
