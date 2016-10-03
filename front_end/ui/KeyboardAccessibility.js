// Copyright (c) 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @constructor
 * @param {!Document}
 *            doc
 */
WebInspector.KeyboardAccessibility = function(doc)
{
    /* Tab, Enter, Space, PgUp, Pgdn, Home, End, left, up, right, down */
    this._navKeys = [ 9, 13, 32, 33, 34, 35, 36, 37, 38, 39, 40 ];
    this._arrowKeys = [ 37, 38, 39, 40 ];
    this._verticalKeys = [ 33, 34, 35, 36, 38, 40 ];
    this._horizontalKeys = [ 37, 39 ];
    this._forwardKeys = [ 34, 35, 39, 40 ];
    this._lineScope = [ 37, 38, 39, 40 ];
    this._chunkScope = [ 33, 34 ];
    this._pageScope = [ 35, 36 ];
    this._spaceKey = 13;
    this._enterKey = 32;

    // over nav
    
    this._tabsSelector = "[data-key-nav=tabs]";
    
    // Styles Panel Selectors
    // TODO: Let the functions below use generic (i.e. not Styles specific)
    // selectors, so that the methods can be used for nav in other panels as
    // well
    this._stylesSectionTitle = "div.styles-section-title";
    this._stylesProperties = "ol.style-properties";
    this._stylesSeparator = "div.styles-section-title-inline,div.sidebar-separator";
    this._stylesSection = "div.styles-section:not([hidden])";
    this._inlineStylesSection = "div.inline-styles-section";
    this._stylesChunk = this._stylesSeparator + "," + this._stylesSection;
    this._stylesDeclaration = "li.styles-section-declaration";
    this._stylesGroup = "ol.style-properties,ol.children";
    this._stylesParent = "li.parent";
    this._stylesExpandedParent = this._stylesParent + ".expanded";
    this._stylesNestedGroup = "ol.children";
    this._stylesExpandedGroup = "ol.children.expanded";
    this._stylesExpandedDeclaration = this._stylesExpandedGroup + ">"
            + this._stylesDeclaration;
    this._visibleStylesDeclarations = this._stylesProperties + ">"
            + this._stylesDeclaration + "," + this._stylesExpandedGroup + ">"
            + this._stylesDeclaration;
    this._stylesExpandElement = ".expand-element";
    this._cssSelector = ".selector";
    this._cssProperty = ".webkit-css-property";
    this._stylesInheritedLink = ".styles-inherited-link";
    this._stylesNodeLink = ".node-link";
    this._stylesDeclarationToggle = "input[type=checkbox].enabled-button";

    doc.addEventListener("keydown", this._handleGlobalKeyDown.bind(this), true);
};

WebInspector.KeyboardAccessibility.prototype = {

    /* Global navigation methods */

    /**
     * @param {boolean}
     *            removeInstant
     */
    _handleGlobalKeyDown: function(event)
    {
        /*
         * only handle nodes and keys commonly used for navigation
         */
        var target = WebInspector.currentFocusElement()
        if (!target || !target.dataset || !target.dataset.keyNav === undefined
                || this._navKeys.indexOf(event.keyCode) === -1) {
            return;
        }
        switch (target.dataset.keyNav) {
        case "styles":
            this._stylesHandleNavigation(event, target);
            break;
        case "tabs":
            this._tabsHandleNavigation(event, target);
            break;
        }
    },
    _getKeyInformation: function(event)
    {
        var keyInfo = {
            isArrow: this._arrowKeys.indexOf(event.keyCode) !== -1,
            isVertical: this._verticalKeys.indexOf(event.keyCode) !== -1,
            isHorizontal: this._horizontalKeys.indexOf(event.keyCode) !== -1,
            isForward: this._forwardKeys.indexOf(event.keyCode) !== -1,
            isLineScope: this._lineScope.indexOf(event.keyCode) !== -1,
            // isChunkScope: this._chunkScope.indexOf(event.keyCode) !== -1,
            isChunkScope: event.ctrlKey,
            // isPageScope: this._pageScope.indexOf(event.keyCode) !== -1,
            isPageScope: event.ctrlKey && event.shiftKey,
            isSpace: event.keyCode === this._enterKey,
            isEnter: event.keyCode === this._spaceKey
        };
        keyInfo.scope = (keyInfo.isPageScope ? "page"
                : (keyInfo.isChunkScope ? "chunk" : "line"));
        return keyInfo;
    },
    _findSibling: function(startNode, selector, isForward)
    {
        return isForward ? this._findNextSibling(startNode, selector) : this
                ._findPreviousSibling(startNode, selector);
    },
    _findNextSibling: function(startNode, selector)
    {
        if (!startNode) {
            return null;
        }
        var node = startNode;
        while (node = node.nextElementSibling) {
            if (node.matches(selector)) {
                break;
            }
        }
        return node;
    },
    _findPreviousSibling: function(startNode, selector)
    {
        if (!startNode) {
            return null;
        }
        var node = startNode;
        while (node = node.previousElementSibling) {
            if (node.matches(selector)) {
                break;
            }
        }
        return node;
    },
    _findFirstExpandedChild: function(startNode)
    {
        var groupNode = this._findNextSibling(startNode,
                this._stylesExpandedGroup);
        return this._query(groupNode, this._stylesDeclaration);
    },
    _findExpandedParent: function(node)
    {
        return this._findPreviousSibling(this._findClosest(node,
                this._stylesNestedGroup), this._stylesExpandedParent);
    },
    _matches: function(node, selector)
    {
        if (!node || !node.matches) {
            return null;
        }
        return node.matches(selector);
    },
    _findClosest: function(node, selector)
    {
        if (!node || !node.closest) {
            return null;
        }
        return node.closest(selector);
    },
    _query: function(node, selector)
    {
        if (!node || !node.querySelector) {
            return null;
        }
        return node.querySelector(selector);
    },
    _queryLast: function(node, selector)
    {
        var nodes = this._queryAll(node, selector);
        return nodes && nodes.length ? nodes.item(nodes.length - 1) : null;
    },
    _queryAll: function(node, selector)
    {
        if (!node || !node.querySelectorAll) {
            return null;
        }
        return node.querySelectorAll(selector);
    },
    _shadowQuery: function(node, outerSelector, innerSelector)
    {
        var shadowHost = this._query(node, outerSelector);
        if (!shadowHost || !shadowHost.shadowRoot) {
            return null;
        }
        return shadowHost.shadowRoot.querySelector(innerSelector);
    },
    _focus: function(node, roving, oldNode)
    {
        WebInspector.KeyboardAccessibility.focus(node, roving, oldNode);
    },
    _markAsRefocus: function(node) {
        WebInspector.KeyboardAccessibility.markAsRefocus(node);
    },
    _unmarkAsRefocus: function(node) {
        WebInspector.KeyboardAccessibility.unmarkAsRefocus(node);
    },
    _isMarkedForRefocus: function(node) {
        return WebInspector.KeyboardAccessibility.isMarkedForRefocus(node);
    },
    _click: function(node, useMouseEvents)
    {
        if (!node || !node.click) {
            return
        }
        var mouseDownEvent = new MouseEvent("mousedown", {clientX: 1, clientY: 1})
        node.dispatchEvent(mouseDownEvent);
        node.click();
        var mouseUpEvent = new MouseEvent("mouseup", {clientX: 1, clientY: 1})
        node.dispatchEvent(mouseUpEvent);
    },

    /* Tabs navigation */
    _tabsHandleNavigation: function(event, target) {
        var foundNode;
        switch(event.keyCode) {
            case WebInspector.KeyboardShortcut.Keys.Left.code:
            case WebInspector.KeyboardShortcut.Keys.Up.code:
                foundNode = this._findPreviousSibling(target, this._tabsSelector);
                event.consume(true);
                break;
            case WebInspector.KeyboardShortcut.Keys.Right.code:
            case WebInspector.KeyboardShortcut.Keys.Down.code:
                foundNode = this._findNextSibling(target, this._tabsSelector);
                event.consume(true);
                break;
            case WebInspector.KeyboardShortcut.Keys.Enter.code:
                console.log("hey")
                this._click(target, true);
                break
        }
        if (foundNode) {
            this._focus(foundNode); 
        }
    },
    
    /* Styles panel navigation */
    _stylesHandleNavigation: function(event, target)
    {
        var keyInfo = this._getKeyInformation(event);
        var foundNode;
        if (keyInfo.isVertical) {
            foundNode = this._stylesHandleVerticalNav(target, keyInfo);
            event.consume(true);
        } else if (keyInfo.isHorizontal) {
            foundNode = this._stylesHandleHorizontalNav(target, keyInfo);
            event.consume(true);
        } else if (keyInfo.isEnter) {
            this._stylesHandleEnter(target);
            event.consume(true);
        } else if (keyInfo.isSpace) {
            this._stylesHandleSpace(target);
            event.consume(true);
        }

        if (foundNode) {
            this._focus(foundNode);
        }
    },
    
    _stylesHandleVerticalNav: function(target, keyInfo) {
        var foundNode = null;
        switch (keyInfo.scope) {
        case "line":
            if (this._matches(target, this._stylesDeclaration)) {
                foundNode = this._findStylesLineSibling(target,
                        keyInfo.isForward);
            } else if (this._matches(target, this._stylesSectionTitle)) {
                foundNode = this._findAdjacentLineFromTitle(target,
                        keyInfo.isForward);
                if (!foundNode) {
                    // empty ruleset
                    foundNode = this._findAdjacentSectionTitle(target,
                            keyInfo.isForward, true);
                }
            } else if (this._matches(target, this._stylesSeparator)) {
                foundNode = this._findAdjacentLineFromSeparator(target,
                        keyInfo.isForward);
            }
            break;
        case "chunk":
            foundNode = this._findAdjacentSectionTitle(target,
                    keyInfo.isForward, true);
            break;
        case "page":
            foundNode = this._findAdjacentSeparator(target,
                    keyInfo.isForward);
            break;
        }  
        return foundNode;
    },
    
    _findStylesLineSibling: function(startNode, isForward)
    {
        var groupNode, foundNode;
        var branch = this._findClosest(startNode, this._stylesGroup);
        if (!branch) {
            return null;
        }
        // 1. Attempt navigation between declarations inside ruleset
        if (!this._matches(branch, this._stylesNestedGroup)) {
            if (isForward
                    && this._matches(startNode, this._stylesExpandedParent)) {
                foundNode = this._findFirstExpandedChild(startNode,
                        this._stylesExpandedGroup);
            } else {
                foundNode = this._findSibling(startNode,
                        this._stylesDeclaration, isForward);
            }
            if (foundNode && !isForward
                    && this._matches(foundNode, this._stylesExpandedParent)) {
                groupNode = this._findNextSibling(foundNode,
                        this._stylesExpandedGroup);
                foundNode = this._queryLast(groupNode, this._stylesDeclaration);
            }
        } else {
            // nested (expanded) declarations
            foundNode = this._findSibling(startNode, this._stylesDeclaration,
                    isForward);
            if (!foundNode) {
                foundNode = this._findSibling(branch, this._stylesDeclaration,
                        isForward);
            }
        }
        // 2. No declaration found, attempt navigation to nearest selector
        if (!foundNode) {
            foundNode = isForward ? this._findAdjacentSectionTitle(branch,
                    true, false) : this._findCurrentSectionTitle(branch);
        }
        // 3. No selector found (would only happen with forward navigation),
        // attempt to find adjacent separator
        if (!foundNode) {
            foundNode = this._findAdjacentSeparator(branch, isForward);
        }
        return foundNode;
    },
    _findCurrentSectionTitle: function(startNode)
    {
        var parent;
        parent = this._findClosest(startNode, this._stylesSection);
        return this._query(parent, this._stylesSectionTitle);
    },
    _findAdjacentSectionTitle: function(startNode, isForward,
            extendPastSeparator)
    {
        var selector = !extendPastSeparator ? this._stylesChunk
                : this._stylesSection;
        var parent, adjacentNode, foundNode;
        var includeSelf = this._matches(startNode, this._stylesDeclaration);
        parent = this._findClosest(startNode, this._stylesChunk);
        if (!isForward && includeSelf) {
            adjacentNode = this._query(parent, this._stylesSectionTitle);
        } else {
            adjacentNode = this._findSibling(parent, selector, isForward);
        }
        if (!adjacentNode || this._matches(adjacentNode, this._stylesSeparator)) {
            return null;
        }
        return this._findCurrentSectionTitle(adjacentNode);
    },
    _findAdjacentSeparator: function(startNode, isForward)
    {
        var parent, foundNode;
        parent = this._findClosest(startNode, this._stylesChunk);
        foundNode = this._findSibling(parent, this._stylesSeparator, isForward);
        if (!foundNode && !isForward) {
            parent = this._findPreviousSibling(parent,
                    this._inlineStylesSection);
            foundNode = this._query(parent, this._stylesSectionTitle);
        }
        return foundNode
    },
    _findAdjacentLineFromTitle: function(startNode, isForward)
    {
        var group, foundNode;
        if (isForward) {
            group = this._findNextSibling(startNode, this._stylesProperties);
            foundNode = this._query(group, this._stylesDeclaration);
        } else {
            group = this._findPreviousSibling(this._findClosest(startNode,
                    this._stylesSection), this._stylesChunk);
            foundNode = this._matches(group, this._stylesSeparator) ? group
                    : this._queryLast(group, this._visibleStylesDeclarations);
        }
        return foundNode;
    },
    _findAdjacentLineFromSeparator: function(startNode, isForward)
    {
        var group, foundNode;
        if (!startNode) {
            return;
        }
        group = this._findSibling(startNode, this._stylesSection, isForward);
        foundNode = isForward ? this._query(group, this._stylesSectionTitle)
                : this._queryLast(group, this._visibleStylesDeclarations);
        return foundNode;
    },
    _stylesHandleHorizontalNav: function(target, keyInfo) {
        var foundNode = null;
        if (this._matches(target, this._stylesParent)) {
            if (keyInfo.isForward) {
                if (!this._matches(target, this._stylesExpandedParent)) {
                    this._click(this._query(target,
                            this._stylesExpandElement));
                } else {
                    foundNode = this._findFirstExpandedChild(target,
                            this._stylesExpandedGroup);
                }
            } else if (!keyInfo.isForward
                    && this._matches(target, this._stylesExpandedParent)) {
                this._click(this._query(target, this._stylesExpandElement));
            }
        } else if (this._matches(target, this._stylesExpandedDeclaration)
                && !keyInfo.isForward) {
            foundNode = this._findExpandedParent(target);
        }
        return foundNode;
    },
    _stylesHandleEnter: function(target) {
        if (this._matches(target, this._stylesDeclaration)) {
            this._markAsRefocus(target);
            this._click(this._query(target, this._cssProperty));
        } else if (this._matches(target, this._stylesSectionTitle)) {
            this._markAsRefocus(target);
            this._click(this._query(target, this._cssSelector));
        } else if (this._matches(target, this._stylesSeparator)) {
            this._click(this._shadowQuery(target, this._stylesInheritedLink, this._stylesNodeLink));
        }
    },
    _stylesHandleSpace: function(target) {
        this._markAsRefocus(target);
        this._click(this._query(target, this._stylesDeclarationToggle));
    }
}

/**
 * @param {!Document}
 *            doc
 */
WebInspector.KeyboardAccessibility.installHandler = function(doc)
{
    new WebInspector.KeyboardAccessibility(doc);
}

WebInspector.KeyboardAccessibility.enableA11y = true;

WebInspector.KeyboardAccessibility.markAsRefocus = function(node) {
    if (!node || !node.dataset) {
        return;
    }
    node.dataset.resetFocus = true;
};

WebInspector.KeyboardAccessibility.unmarkAsRefocus = function(node) {
    if (!node || !node.dataset) {
        return;
    }
    delete node.dataset.resetFocus;
};

WebInspector.KeyboardAccessibility.isMarkedForRefocus = function(node) {
    console.trace("latest")
    if (node && node.matches) {
        return node.matches("[data-reset-focus]");
    }
    return false;
};
WebInspector.KeyboardAccessibility.focus = function(node, roving, oldNode)
{
    console.log("focus %o", node);
    if (!WebInspector.KeyboardAccessibility.enableA11y) {
        return false;
    }
    // replace with whatever focus approach is deemed best
    if (node && node.nodeType === 1) {
        node.focus();
        if (roving && oldNode) {
            oldNode.tabIndex = -1;
            node.tabIndex = 0;
        }
        return true
    }
    return false;
};
