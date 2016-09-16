// Copyright (c) 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @constructor
 * @param {!Document} doc
 */
WebInspector.KeyboardAccessibility = function(doc)
{
    doc.addEventListener("keydown", this._handleGlobalKeyDown.bind(this), true);
};

WebInspector.KeyboardAccessibility.prototype = {
    /**
     * @param {boolean} removeInstant
     */
    _handleGlobalKeyDown : function(event)
    {
        /* only handle keys commonly used for navigation: Tab, Enter, Space, PgUp, Pgdn, Home, End, left, up, right, down*/
        if ([9, 13, 32, 33, 34, 35, 36, 37, 38, 39, 40]
                .indexOf(event.keyCode) === -1) {
            return;
        }
        if (event.target.classList.contains("styles-section-declaration")) {
            _handleStylesNavigation(event);   
        }
        

        var widgetType = event.target.getAttribute('data-widget-type');
        if (!widgetType) {
            return;
        }
        switch (widgetType) {

        case "styleLine":
            console.log(widgetType + "!");
            break;
        }

    },
    _getKeyInformation: function(event) 
    {
        return {
            isVertical: [33, 34, 35, 36, 38, 40].indexOf(event.keyCode) !== -1,
            isHorizontal: [33, 34, 35, 36, 38, 40].indexOf(event.keyCode) !== -1,
            isForward: [34, 35, 39, 40].indexOf(event.keyCode) !== -1,
            isLineScope: [37, 38, 39, 40].indexOf(event.keyCode) !== -1,
            isChunkScope: [33, 34].indexOf(event.keyCode) !== -1,
            isPageScope: [35, 36].indexOf(event.keyCode) !== -1,
            isSpace: event.keyCode === 13,
            isEnter: event.keyCode === 32
        };
    },
    _handleStylesNavigation: function(event) 
    {
        var keyInformation = _getKeyInformation(event);
        var target = event.target;
    },
    _findStylesLineSibling: function(startNode, isForward) 
    {
        var branch = startNode.closest(".style-properties, .children");
        var siblings, sibling, currentIndex, newIndex, endNode;
        
        if (!branch) {
            return null;
        }
        siblings = [...branch.querySelector(":not(.children)>.styles-section-declaration")];
        var currentIndex = siblings.indexOf(startNode);
        
        if (startNode.classList.contains("parent") && startNode.classList.contains("expanded")) {
            
        }
        else {
            newIndex = isForward ? currentIndex + 1 : currenIndex -1;
            if (newIndex < 0) {
                endNode = _findStylesSectionSibling(startNode, isForward);
            } else if (newIndex >= sibings,length) {
                endNode = _findStylesSectionSibling(startNode, isForward);
            } 
            else {
                endNode = siblings[newIndex];
            }
        }
        
        
        
        
        var endNode= isForward ? startNode.previousSibling : startNode.nextSibling;
        if (!endNode || !endNode.classList.contains("styles-section") || !endNode.classList.contains("sidebar-separator")) {
            return null;
        }
    },
    _findStylesSectionSibling: function(startNode, isForward) 
    {
        startNode = startNode.closest(".styles-section, .sidebar-separator");
        if (!startNode) {
            return null;
        }
        var endNode = isForward ? startNode.previousSibling : startNode.nextSibling;
        if (!endNode || !endNode.classList.contains("styles-section") || !endNode.classList.contains("sidebar-separator")) {
            return null;
        }
        return endNode; 
    }
    
}

/**
 * @param {!Document} doc
 */
WebInspector.KeyboardAccessibility.installHandler = function(doc)
{
    new WebInspector.KeyboardAccessibility(doc);
}
