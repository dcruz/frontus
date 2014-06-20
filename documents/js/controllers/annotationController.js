'use strict';

function annotationController($scope, $element, $rootScope, $document, Annotations) {
    function applyLineBreaks(oTextarea) {
        var max = Math.floor(parseInt(oTextarea.style.height)/12);
        if (oTextarea.wrap) {
            oTextarea.setAttribute("wrap", "off");
        } else {
            oTextarea.setAttribute("wrap", "off");
            var newArea = oTextarea.cloneNode(true);
            newArea.value = oTextarea.value;
            oTextarea.parentNode.replaceChild(newArea, oTextarea);
            oTextarea = newArea;
        }

        var strRawValue = oTextarea.value;
        oTextarea.value = "";
        var nEmptyWidth = oTextarea.scrollWidth;
        var nLastWrappingIndex = -1;

        function testBreak(strTest) {
            oTextarea.value = strTest;
            return oTextarea.scrollWidth > nEmptyWidth;
        }
        function findNextBreakLength(strSource, nLeft, nRight) {
            var nCurrent;
            if(typeof(nLeft) == 'undefined') {
                nLeft = 0;
                nRight = -1;
                nCurrent = 64;
            }
            else {
                if (nRight == -1)
                    nCurrent = nLeft * 2;
                else if (nRight - nLeft <= 1)
                    return Math.max(2, nRight);
                else
                    nCurrent = nLeft + (nRight - nLeft) / 2;
            }
            var strTest = strSource.substr(0, nCurrent);
            var bLonger = testBreak(strTest);
            if(bLonger)
                nRight = nCurrent;
            else
            {
                if(nCurrent >= strSource.length)
                    return null;
                nLeft = nCurrent;
            }
            return findNextBreakLength(strSource, nLeft, nRight);
        }

        var i = 0, j;
        var strNewValue = "";
        while (i < strRawValue.length) {
            var breakOffset = findNextBreakLength(strRawValue.substr(i));
            if (breakOffset === null) {
                strNewValue += strRawValue.substr(i);
                break;
            }
            nLastWrappingIndex = -1;
            var nLineLength = breakOffset - 1;
            for (j = nLineLength - 1; j >= 0; j--) {
                var curChar = strRawValue.charAt(i + j);
                if (curChar == ' ' || curChar == '-' || curChar == '+') {
                    nLineLength = j + 1;
                    break;
                }
            }
            strNewValue += strRawValue.substr(i, nLineLength) + "\n";
            i += nLineLength;
        }
        var re = /\n/g;
        var lastre = /\n(?!.*\n)/;
        var count = strNewValue.match(re);
        if (count && max <= count.length) {
            strNewValue = strNewValue.split("\n", max).join("\n");
        }
        oTextarea.value = strNewValue;
        $scope.annot.val = strNewValue;
        oTextarea.setAttribute("wrap", "hard");
        return oTextarea.value.replace(new RegExp("\\n", "g"), "<br />");
    }

    var dragicon = $element.find("span.dragger");

    /* This is the drag - code -- its been moved to work on the drag widget */
    $scope.mousedown = function($event) {
        $scope.initdrag($event);
        return false;
    };

    // TODO: shouldn't bind here, but ng-mousedown appears to not stop propagation
    dragicon.bind('mousedown', $scope.mousedown);

    $scope.$watch('annot.val', function(newValue, oldValue) {
        // prevent issuers from filling in the investor values
        if ($rootScope.navState.role == "issuer" && $scope.annot.whosign == "Investor") {
            $scope.annot.val = "";
        }
    });

    $scope.$watch('annot.whattype', function(newval, oldval) {
        var elem = $element.find('textarea');
        if (newval == "Signature") {
            $scope.annot.fontsize = 18;
            if ($scope.annot.position.size.height < 37) {
                $scope.annot.position.size.height = 37;
            }
        }
        else {
            $scope.annot.fontsize = 12;
        }
    });

    var topLocation = function(elementHeight, mouseY) {
        var docPanel = document.querySelector('.docPanel');
        var topEdge = docPanel.offsetTop;
        var panelHeight = docPanel.offsetHeight;
        var bottomEdge = topEdge + panelHeight;
        if (mouseY < topEdge) {
            return 0;
        } else if (mouseY > bottomEdge - elementHeight) {
            return (panelHeight - elementHeight);
        } else {
            return mouseY - topEdge;
        }
    };

    var leftLocation = function(elementWidth, mouseX) {
        var docPanel = document.querySelector('.docPanel');
        var leftEdge = docPanel.offsetLeft;
        var panelWidth = docPanel.offsetWidth;
        var rightEdge = leftEdge + panelWidth;
        if (mouseX < leftEdge) {
            return 0;
        } else if (mouseX > rightEdge - elementWidth) {
            return (panelWidth - elementWidth);
        } else {
            return mouseX - leftEdge;
        }
    };

    $scope.mousemove = function($event) {
        // absolute mouse location (current): $event.clientX, $event.clientY
        // absolute change in mouse location: dx, dy
        // relative mouse location: mousex, mousey
        var dx = $event.clientX - $scope.initialMouseX + document.documentElement.scrollLeft - $scope.initialScrollX;
        var dy = $event.clientY - $scope.initialMouseY + document.documentElement.scrollTop - $scope.initialScrollY;
        var mousex = $scope.startX + dx;
        var mousey = $scope.startY + dy;
        $scope.$apply(function() {
            $scope.annot.position.coords.y = topLocation($element.height(), mousey);
            $scope.annot.position.coords.x = leftLocation($element.width(), mousex);
        });
        return false;
    };
    $scope.newmousemove = function($event) {
        $scope.$apply(function() {
            var dx = $event.clientX - $scope.initialMouseX + document.documentElement.scrollLeft - $scope.initialScrollX;
            var dy = $event.clientY - $scope.initialMouseY + document.documentElement.scrollTop - $scope.initialScrollY;
            $scope.annot.position.size.height = dy - 4;
            $scope.annot.position.size.width = dx - 8;
            return false;
        });
    };

    var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? "DOMMouseScroll" : "mousewheel"; //FF doesn't recognize mousewheel as of FF3.x

    $scope.mouseup = function(ev) {
        $scope.mousemove(ev);
        if (document.detachEvent) {
            document.detachEvent('on'+mousewheelevt, $scope.mousemove);
        } else if (document.removeEventListener) {
            document.removeEventListener(mousewheelevt, $scope.mousemove, false);
        }
        $document.unbind('scroll', $scope.mousemove);
        $document.unbind('mousemove', $scope.mousemove);
        $document.unbind('mouseup', $scope.mouseup);
        return false;
    };

    $scope.newmouseup = function(ev) {
        if (document.detachEvent) {
            document.detachEvent('on'+mousewheelevt, $scope.mousemove);
        } else if (document.removeEventListener) {
            document.removeEventListener(mousewheelevt, $scope.mousemove, false);
        }
        $document.unbind('scroll', $scope.mousemove);
        $document.unbind('mousemove', $scope.newmousemove);
        $document.unbind('mouseup', $scope.newmouseup);
        $scope.$apply(function() {
            if (parseInt($scope.annot.position.size.width) === 0 || parseInt($scope.annot.position.size.height) < 12) {
                $scope.closeMe();
            }
            $scope.getme = true;
        });
        return false;
    };

    $scope.closeMe = function() {
        $scope.removeannot()($scope.annot);
    };

    // Set startX/Y and initialMouseX/Y attributes.
    // Bind mousemove and mousedown event callbacks.
    //
    $scope.initdrag = function(ev) {
        var dp = document.querySelector(".docPanel");
        var dpr = dp.getBoundingClientRect(); // top/left of docPanel
        var dprl = dpr.left - dp.offsetLeft; // left of document itself
        var dprt = dpr.top - dp.offsetTop; // top of document itself
        $scope.startX = ev.clientX - dprl + 5; // mouse start positions relative to the box/pad
        var bb = $element[0].querySelector("textarea");
        $scope.startY = ev.clientY - dprt - (parseInt(bb.style.height)/2); // TODO can we get 6 dynamically?
        $scope.initialMouseX = ev.clientX;
        $scope.initialMouseY = ev.clientY;
        $scope.initialScrollX = document.documentElement.scrollLeft;
        $scope.initialScrollY = document.documentElement.scrollTop;
        if (document.attachEvent) {
            document.attachEvent('on'+mousewheelevt, $scope.mousemove);
        } else if (document.addEventListener) {
            document.addEventListener(mousewheelevt, $scope.mousemove, false);
        }
        $document.bind('scroll', $scope.mousemove);
        $document.bind('mousemove', $scope.mousemove);
        $document.bind('mouseup', $scope.mouseup);
    };

    $scope.newinitdrag = function(ev) {
        var dp = document.querySelector(".docPanel");
        var dpr = dp.getBoundingClientRect(); // top/left of docPanel
        var dprl = dpr.left - dp.offsetLeft; // left of document itself
        var dprt = dpr.top - dp.offsetTop; // top of document itself
        $scope.startX = ev.clientX - dprl - 6; // mouse start positions relative to the box/pad
        $scope.startY = ev.clientY - dprt - 6; // TODO can we get 6 dynamically?
        $scope.initialMouseX = ev.clientX;
        $scope.initialMouseY = ev.clientY;
        $scope.initialScrollX = document.documentElement.scrollLeft;
        $scope.initialScrollY = document.documentElement.scrollTop;
        var dx = ev.clientX - $scope.initialMouseX;
        var dy = ev.clientY - $scope.initialMouseY;
        var mousex = $scope.startX + dx;
        var mousey = $scope.startY + dy;
        $scope.annot.position.coords.y = topLocation($element.height(), mousey);
        $scope.annot.position.coords.x = leftLocation($element.width(), mousex);
        if (document.attachEvent) {
            document.attachEvent('on'+mousewheelevt, $scope.mousemove);
        } else if (document.addEventListener) {
            document.addEventListener(mousewheelevt, $scope.mousemove, false);
        }
        $document.bind('scroll', $scope.mousemove);
        $document.bind('mousemove', $scope.newmousemove);
        $document.bind('mouseup', $scope.newmouseup);
    };

    $scope.imageMine = function() {
        var role = $rootScope.navState.role;
        var whosign = $scope.annot.whosign;
        return (role == "issuer" && whosign == "Issuer") ||
               (role == "investor" && whosign == "Investor") ? true : false;
    };
    $scope.whosignssticky = function() {
        var role = $rootScope.navState.role;
        var whosign = $scope.annot.whosign;
        return (role == "issuer" && whosign == "Investor") ||
               (role == "investor" && whosign == "Issuer") ? true : false;
    };

    $scope.openBox = function(ev, event) {
        if ($rootScope.navState.role == "issuer" && !$scope.countersignable($scope.lib)) {
            $scope.getme = true;
        }
        if ($scope.annot.whattype == "ImgSignature" && (($scope.annot.whosign == 'Investor' && $rootScope.navState.role == 'investor') || ($scope.annot.whosign == 'Issuer' && $rootScope.navState.role == 'issuer'))) {
            var textarea = event.currentTarget;
            var width = parseInt(textarea.style.width);
            var height = parseInt(textarea.style.height);
            var boxwidth = 330;
            var boxheight = 200;
            var ratio;
            if (height > width) {
                ratio = boxheight / height;
                height = boxheight;
                width = width * ratio;
            }
            else {
                ratio = boxwidth / width;
                width = boxwidth;
                height = height * ratio;
            }
            $scope.signaturestyle = {height: String(180), width: String(330) };
            $scope.currentsignature = textarea;
            $scope.signatureURL = '/photo/user?id=signature:';
            $scope.sigModalUp();
        }
    };

    function setPlaceholder() {
        $scope.whosignlabel = ($scope.annot.whosign == "Investor") ? "Recipient" : $rootScope.navState.name;
        $scope.whattypelabel = Annotations.attributeLabel($scope.annot.whattype);
        $scope.val_placeholder = $scope.whosignlabel + " " + $scope.whattypelabel;
    }
    setPlaceholder();

    function setDefaultText() {
        if ($scope.annot.val.length === 0) {
            if (($rootScope.navState.role == "issuer" && $scope.annot.whosign == "Issuer") || $rootScope.navState.role == "investor" && $scope.annot.whosign == "Investor") {
                $scope.annot.val = Annotations.investorAttribute([$scope.annot.whattype]);
            } else {
                $scope.annot.val = "";
            }
        }
    }

    $scope.setSign = function($event, value) {
        $scope.annot.whosign = value;
        $scope.annot.val = "";
        setDefaultText();
        setPlaceholder();
    };

    $scope.setAnnot = function($event, sticky, value) {
        $scope.annot.whattype = value;
        $scope.annot.val = ""; // clear out value since the type changed
        setDefaultText();
        setPlaceholder();
    };

    $scope.addLineBreaks = function($event) {
        $event.target = applyLineBreaks($event.target);
    };

    $scope.closeBox = function() {
        if ($rootScope.navState.role == "issuer") {
            $scope.getme = false;
        }
    };

    $scope.investorFixed= function() {
        return $scope.annot.investorfixed && $rootScope.navState.role == 'investor' ? false : true;
    };

    $scope.annotationCoordsStyle = {};
    $scope.annotationSizeStyle = {};

    $scope.$watch('annot.position.coords', function(new_coords) {
        if (new_coords) {
            $scope.annotationCoordsStyle.top = Math.max(0, new_coords.y) + "px";
            $scope.annotationCoordsStyle.left = Math.max(0, new_coords.x) + "px";
        }
    }, true);

    $scope.$watch('annot.position.size', function(new_size) {
        if (new_size) {
            $scope.annotationSizeStyle.width = (new_size.width - 14) + "px";
            $scope.annotationSizeStyle.height = (new_size.height - 10) + "px";
        }
    }, true);

    $scope.$watch('annot.fontsize', function(new_fontsize) {
        if (new_fontsize) {
            $scope.annotationSizeStyle["font-size"] = new_fontsize;
        }
    });

    if ($scope.annot.initDrag) {
        $scope.newinitdrag($scope.annot.initDrag);
        delete $scope.annot.initDrag;
    }

    $scope.signaturepresent = $scope.$parent.signaturepresent;

    // MOCKS
    // TODO: fix these (probably references into parent scope)
    $scope.lib = {};
    $scope.countersignable = function() {
        return false;
    };
}

annotationController.$inject = ["$scope", "$element", "$rootScope", "$document", "Annotations"];
