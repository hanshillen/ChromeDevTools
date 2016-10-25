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
    var keys = WebInspector.KeyboardShortcut.Keys;
    /* Tab, Enter, Space, PgUp, Pgdn, Home, End, left, up, right, down */
    this._navKeys = [ keys.Tab.code, keys.Enter.code, 32, 33, 34, 35, 36, 37, 38, 39, 40 ];
    this._arrowKeys = [ 37, 38, 39, 40 ];
    this._verticalKeys = [ 33, 34, 35, 36, 38, 40 ];
    this._horizontalKeys = [ 37, 39 ];
    this._edgeKeys = [35, 36];
    this._pageKeys = [33, 34];
    this._forwardKeys = [ 34, 35, 39, 40 ];
    this._itemScope = [ 37, 38, 39, 40 ];
    this._groupScope = [ 33, 34 ];
    this._sectionScope = [ 35, 36 ];
    this._spaceKey = keys.Space.code;
    this._enterKey = keys.Enter.code;
    
    this._selectors = WebInspector.KeyboardAccessibility.selectors;
    
    doc.addEventListener("keydown", this._handleGlobalKeyDown.bind(this), true);
    
    // TODO: come u[p with elegant way for proper keyboard support for context
    // menus on OSX
    if (WebInspector.isMac()) {
        doc.addEventListener("keydown", function(event){
            // for now we'll use Shift + F10, since this is the native context
            // menu shortcut on Windows
            if (event.keyCode == 121 && event.shiftKey) {
                var mouseEvent = new MouseEvent("contextmenu");
                event.target.dispatchEvent(mouseEvent);
            }
        }, true);
    }
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
        if (!target || !target.dataset || target.dataset.keyNav === undefined
                || this._navKeys.indexOf(event.keyCode) === -1) {
            return;
        }
        
        switch (target.dataset.keyNav) {
        case "tree":
            this._treeHandleNavigation(event, target);
            break;
        case "tabs":
            this._tabsHandleNavigation(event, target);
            break;
        case "log":
            this._logHandleNavigation(event, target);
            break;
        case "toolbar":
            this._toolbarHandleNavigation(event, target);
            break;
        }
    },
    _getKeyInformation: function(event)
    {
        var keyInfo = {
            isArrow: this._arrowKeys.indexOf(event.keyCode) !== -1,
            isVertical: this._verticalKeys.indexOf(event.keyCode) !== -1,
            isHorizontal: this._horizontalKeys.indexOf(event.keyCode) !== -1,
            isEdge: this._edgeKeys.indexOf(event.keyCode) !== -1,
            isPage: this._pageKeys.indexOf(event.keyCode) !== -1,
            isForward: this._forwardKeys.indexOf(event.keyCode) !== -1,
            isItemScope: this._itemScope.indexOf(event.keyCode) !== -1,
            // isGroupScope: this._groupScope.indexOf(event.keyCode) !== -1,
            isGroupScope: event.ctrlKey,
            // isSectionScope: this._SectionScope.indexOf(event.keyCode) !== -1,
            isSectionScope: event.ctrlKey && event.shiftKey,
            isEnter: event.keyCode === this._enterKey,
            isSpace: event.keyCode === this._spaceKey
        };
        keyInfo.scope = (keyInfo.isSectionScope ? "section"
                : (keyInfo.isGroupScope ? "group" : "item"));
        return keyInfo;
    },
    _findSibling: function(startNode, selector, isForward, byIndex, parentNodeOrSelector, skipNumber)
    {
        if (byIndex) {
            return this._findSiblingByIndex(startNode, selector, isForward, parentNodeOrSelector, skipNumber)
        }
        return isForward ? this._findNextSibling(startNode, selector) : this
                ._findPreviousSibling(startNode, selector);
    },
    
    _findSiblingByIndex: function(startNode, selector, isForward, parentNodeOrSelector, skipNumber) {
        var parent = typeof parentNodeOrSelector === "string" ? document.querySelector(parentNodeOrSelector) : parentNodeOrSelector;
        if (!startNode || !parent || !parent.querySelectorAll) {
            return null;
        }
        if (!skipNumber) {
            skipNumber = 1;
        }
        var nodes = [...parent.querySelectorAll(selector)];
        var currentIndex = nodes.indexOf(startNode);
        var adjacentIndex = isForward ? currentIndex + skipNumber : currentIndex -skipNumber;
        
        if (adjacentIndex < 0 && -adjacentIndex < skipNumber) {
            adjacentIndex = 0;
        } else if (adjacentIndex >= nodes.length && (adjacentIndex - nodes.length) < skipNumber ) {
            adjacentIndex = nodes.length - 1;
        } else if (adjacentIndex < 0 || adjacentIndex >= nodes.length ) {
            return null;
        }
        return nodes[adjacentIndex];
    },
    _findNextSibling: function(startNode, selector, byIndex)
    {
        if (!startNode) {
            return null;
        }
        var node = startNode;
        while (node = node.nextElementSibling) {
            if (this._matches(node, selector)) {
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
            if (this._matches(node, selector)) {
                break;
            }
        }
        return node;
    },
    _findFirstSibling: function(startNode, selector) {
        if (!startNode) {
            return null;
        }
        var node = startNode.parentNode.firstChild;
        do {
            if (this._matches(node, selector)) {
                break
            }
        } while (node = node.nextSibling);
        return node;
    },
    _findFirstExpandedChild: function(startNode)
    {
        var groupNode = this._findNextSibling(startNode,
                this._selectors.tree.expandedGroup);
        return this._query(groupNode, this._selectors.tree.item);
    },
    _findExpandedParent: function(node)
    {
        return this._findPreviousSibling(this._findClosest(node,
                this._selectors.tree.group), this._selectors.tree.expandedParent);
    },
    _matches: function(node, ...selector)
    {
        return WebInspector.KeyboardAccessibility.matches(node, ...selector)
    },
    _findClosest: function(node, selector, useOffsetParent)
    {
        if (useOffsetParent) {
            // TODO: inaccurate hack, find proper way to get closest from within
            // shadow DOM
            node = node.offsetParent
        }
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
    _click: function(node)
    {
        if (!node || !node.click) {
            return
        }
        // TODO: ugly hack to deal with click treeoutline triangle click handler
        // using ::before and computed styles to calculate click target
        // Once that handle is improved, this hack can be replaced with
        // something more robust
        var pageX = node.totalOffsetLeft() + 15;
        var pageY = node.totalOffsetTop() + 15;
        
        
        var mouseDownEvent = new MouseEvent("mousedown", {clientX: pageX, clientY: pageY, bubbles: true});
        node.dispatchEvent(mouseDownEvent);
        
        var clickEvent = new MouseEvent("click", {
            clientX: pageX,
            clientY: pageY,
            bubbles: true
            });
        node.dispatchEvent(clickEvent);
        var mouseUpEvent = new MouseEvent("mouseup", {clientX: pageX, clientY: pageY, bubbles: true});
        node.dispatchEvent(mouseUpEvent);
    },
    
    _toolbarHandleNavigation: function(event, target) {
        var foundNode;
        var keyInfo = this._getKeyInformation(event);
        var keys = WebInspector.KeyboardShortcut.Keys;
        
        switch (event.keyCode) {
        case keys.Left.code:
        case keys.Right.code:
            var toolbar = this._findClosest(target, this._selectors.toolbar.group, true);
            foundNode = this._findSiblingByIndex(target, this._selectors.toolbar.item, keyInfo.isForward, toolbar);
            break;
        }
        if (foundNode) {
            event.consume(true);
            this._focus(foundNode); 
        }
    },
    
    /* log rows navigation */
    
    _logHandleNavigation: function(event, target) {
        var foundNode;
        var keyInfo = this._getKeyInformation(event);
        var keys = WebInspector.KeyboardShortcut.Keys;
        
        if (this._matches(target, this._selectors.log.row) || this._matches(target, this._selectors.log.rowObject)) {
            if ((keyInfo.isArrow && keyInfo.isVertical) || keyInfo.isPage) {
                let rowSelector = this._selectors.log.row;
                foundNode = this._findSibling(this._findClosest(target, rowSelector), rowSelector, keyInfo.isForward, true, this._selectors.log.group, keyInfo.isPage ? 10 : 1);
            } else if (keyInfo.isArrow && keyInfo.isHorizontal) {
                foundNode = this._logHandleHorizontalNav(target, keyInfo, false);
            }
        }
        if (this._matches(target, this._selectors.log.row)) {
            //TODO: Home & End currently don't work correctly because only the visible log rows are actually in the DOM
            if (keyInfo.isEdge) {
                let logGroup = this._findClosest(target, this._selectors.log.group);
                foundNode = this[keyInfo.isForward ? "_queryLast" : "_query"](logGroup, this._selectors.log.row);
            }
        } else if (this._matches(target, this._selectors.log.rowObject)) {
            if (keyInfo.isHorizontal || keyInfo.isEdge) {
                foundNode = this._logHandleHorizontalNav(target, keyInfo, keyInfo.isEdge);
            } else if (keyInfo.isEnter) {
                if (this._query(target, this._selectors.util.shadowHost)) {
                    this._click(this._shadowQuery(target, this._selectors.util.shadowHost, this._selectors.util.shadowClickTarget));
                } else {
                    this._click(target);
                }
            }
        }
        if (foundNode) {
            event.consume(true);
            this._focus(foundNode); 
        } 
    },

    _logHandleHorizontalNav: function(target, keyInfo, isEdge) {
        var foundNode;
        if (this._matches(target, this._selectors.log.row) && keyInfo.isForward) {
            foundNode = this._query(target, this._selectors.log.rowObject);
        } else if (this._matches(target, this._selectors.log.rowObject)) {
            let parentRow = this._findClosest(target, this._selectors.log.row);
            foundNode = this._findSiblingByIndex(target, this._selectors.log.rowObject, keyInfo.isForward, parentRow);
            if ((!foundNode || isEdge) && !keyInfo.isForward) {
                foundNode = parentRow;
            } else if (isEdge) {
                foundNode = this._queryLast(parentRow, this._selectors.log.rowObject);
            }
        }
        return foundNode;
    },
    
    
    /* Tabs navigation */
    _tabsHandleNavigation: function(event, target) {
        var foundNode;
        switch(event.keyCode) {
            case WebInspector.KeyboardShortcut.Keys.Left.code:
            case WebInspector.KeyboardShortcut.Keys.Up.code:
                foundNode = this._findPreviousSibling(target, this._selectors.tabs.tab);
                event.consume(true);
                break;
            case WebInspector.KeyboardShortcut.Keys.Right.code:
            case WebInspector.KeyboardShortcut.Keys.Down.code:
                foundNode = this._findNextSibling(target, this._selectors.tabs.tab);
                event.consume(true);
                break;
            case WebInspector.KeyboardShortcut.Keys.Enter.code:
                this._click(target);
                break
        }
        if (foundNode) {
            this._focus(foundNode); 
        }
    },
    
    /* Tree widget navigation */
    _treeHandleNavigation: function(event, target)
    {
        var keyInfo = this._getKeyInformation(event);
        var foundNode;
        if (keyInfo.isVertical) {
            foundNode = this._treeHandleVerticalNav(target, keyInfo);
            event.consume(true);
        } else if (keyInfo.isHorizontal) {
            foundNode = this._treeHandleHorizontalNav(target, keyInfo);
            event.consume(true);
        } else if (keyInfo.isEnter) {
            this._treeHandleEnter(target);
            event.consume(true);
        } else if (keyInfo.isSpace) {
            this._treeHandleSpace(target);
            event.consume(true);
        }
        if (foundNode) {
            this._focus(foundNode);
        }
    },
    
    _treeHandleVerticalNav: function(target, keyInfo) {
        var foundNode = null;
        switch (keyInfo.scope) {
        case "item":
            if (this._matches(target, this._selectors.tree.item)) {
                foundNode = this._findAdjacentTreeItem(target,
                        keyInfo.isForward);
            } else if (this._matches(target, this._selectors.tree.groupTitle)) {
                foundNode = this._findAdjacentTreeItemFromTitle(target,
                        keyInfo.isForward);
                
                if (!foundNode) {
                    // empty ruleset
                    foundNode = this._findAdjacentTreeSectionTitle(target,
                            keyInfo.isForward, true);
                }
            } else if (this._matches(target, this._selectors.tree.separator)) {
                foundNode = this._findAdjacentTreeItemFromSeparator(target,
                        keyInfo.isForward);
            }
            break;
        case "group":
            foundNode = this._findAdjacentTreeSectionTitle(target,
                    keyInfo.isForward, true);
            break;
        case "section":
            foundNode = this._findAdjacentTreeSeparator(target,
                    keyInfo.isForward);
            break;
        }  
        return foundNode;
    },
    
    _findAdjacentTreeItem: function(startNode, isForward)
    {
        var groupNode, foundNode;
        var branch = this._findClosest(startNode, this._selectors.tree.group);
        if (!branch) {
            return null;
        }
        // 1. Attempt navigation between declarations inside ruleset
        if (!this._matches(branch, this._selectors.tree.group)) {
            if (isForward
                    && this._matches(startNode, this._selectors.tree.expandedParent)) {
                foundNode = this._findFirstExpandedChild(startNode,
                        this._selectors.tree.expandedGroup);
            } else {
                foundNode = this._findSibling(startNode,
                        this._selectors.tree.item, isForward);
            }
            if (foundNode && !isForward
                    && this._matches(foundNode, this._selectors.tree.expandedParent)) {
                groupNode = this._findNextSibling(foundNode,
                        this._selectors.tree.expandedGroup);
                foundNode = this._queryLast(groupNode, this._selectors.tree.item);
            }
        } else {
            // nested (expanded) declarations
            foundNode = this._findSibling(startNode, this._selectors.tree.item,
                    isForward);
            if (!foundNode) {
                foundNode = this._findSibling(branch, this._selectors.tree.item,
                        isForward);
            }
        }
        // 2. No declaration found, attempt navigation to nearest selector
        if (!foundNode) {
            foundNode = isForward ? this._findAdjacentTreeSectionTitle(branch,
                    true, false) : this._findCurrentTreeSectionTitle(branch);
        }
        // 3. No selector found (would only happen with forward navigation),
        // attempt to find adjacent separator
        if (!foundNode) {
            
            foundNode = this._findAdjacentTreeSeparator(branch, isForward);
        }
        return foundNode;
    },
    _findCurrentTreeSectionTitle: function(startNode)
    {
        var parent;
        parent = this._findClosest(startNode, this._selectors.tree.section);
        return this._query(parent, this._selectors.tree.groupTitle);
    },
    _findAdjacentTreeSectionTitle: function(startNode, isForward,
            extendPastSeparator)
    {
        var selector = !extendPastSeparator ? this._selectors.tree.sectionOrSeperator
                : this._selectors.tree.section;
        var parent, adjacentNode, foundNode;
        var includeSelf = this._matches(startNode, this._selectors.tree.item);
        parent = this._findClosest(startNode, this._selectors.tree.sectionOrSeperator);
        if (!isForward && includeSelf) {
            adjacentNode = this._query(parent, this._selectors.tree.groupTitle);
        } else {
            adjacentNode = this._findSibling(parent, selector, isForward);
        }
        if (!adjacentNode || this._matches(adjacentNode, this._selectors.tree.separator)) {
            return null;
        }
        return this._findCurrentTreeSectionTitle(adjacentNode);
    },
    _findAdjacentTreeSeparator: function(startNode, isForward)
    {
        var parent, foundNode;
        parent = this._findClosest(startNode, this._selectors.tree.sectionOrSeperator);
        foundNode = this._findSibling(parent, this._selectors.tree.separator, isForward);
        if (!foundNode && !isForward) {
            parent = this._findFirstSibling(parent,
                    this._selectors.tree.section);
            foundNode = this._query(parent, this._selectors.tree.groupTitle);
        }
        return foundNode
    },
    _findAdjacentTreeItemFromTitle: function(startNode, isForward)
    {
        var group, foundNode;
        if (isForward) {
            group = this._findNextSibling(startNode, this._selectors.tree.group);
            foundNode = this._query(group, this._selectors.tree.item);
        } else {
            group = this._findPreviousSibling(this._findClosest(startNode,
                    this._selectors.tree.section), this._selectors.tree.sectionOrSeperator);
            foundNode = this._matches(group, this._selectors.tree.separator) ? group
                    : this._queryLast(group, this._selectors.tree.visibleItems);
        }
        return foundNode;
    },
    _findAdjacentTreeItemFromSeparator: function(startNode, isForward)
    {
        var group, foundNode;
        if (!startNode) {
            return;
        }
        group = this._findSibling(startNode, this._selectors.tree.section, isForward);
        foundNode = isForward ? this._query(group, this._selectors.tree.groupTitle)
                : this._queryLast(group, this._selectors.tree.visibleItems);
        return foundNode;
    },
    _treeHandleHorizontalNav: function(target, keyInfo) {
        var foundNode = null;
        if (this._matches(target, this._selectors.tree.parent)) {
            if (keyInfo.isForward) {
                if (!this._matches(target, this._selectors.tree.expandedParent)) {
                    this._click(this._query(target,
                            this._selectors.tree.expander));
                } else {
                    foundNode = this._findFirstExpandedChild(target,
                            this._selectors.tree.expandedGroup);
                }
            } else if (!keyInfo.isForward
                    && this._matches(target, this._selectors.tree.expandedParent)) {
                this._click(this._query(target, this._selectors.tree.expander));
            }
        } else if (this._matches(target, this._selectors.tree.expandedItem)
                && !keyInfo.isForward) {
            foundNode = this._findExpandedParent(target);
        }
        return foundNode;
    },
    _treeHandleEnter: function(target) {
        if (this._matches(target, this._selectors.tree.item, this._selectors.tree.groupTitle)) {
            this._markAsRefocus(target);
            this._click(this._query(target, this._selectors.tree.itemClickTarget));
        } else if (this._matches(target, this._selectors.tree.separator)) {
            this._click(this._shadowQuery(target, this._selectors.util.shadowHost, this._selectors.util.shadowClickTarget));
        }
    },
    _treeHandleSpace: function(target) {
        this._markAsRefocus(target);
        this._click(this._query(target, this._selectors.util.toggle));
    }
}

WebInspector.KeyboardAccessibility.selectors = {};

/** SELECTORS * */
// TODO: Figure out how to best structure these and where to define them
var selectors = {};

// reusable parts between widgets
selectors.util = {
    shadowHost: "[data-shadow-host]",
    shadowClickTarget: "[data-shadow-click-target]",
    toggle: "[data-toggle-control]",
    resetFocus: "[data-reset-focus]"
};

// widgets

selectors.tabs = {
    tab: "[data-key-nav=tabs]"
}

// tree structure
selectors.tree = {
    groupTitle: "[data-tree-group-title]",
    group: "[data-tree-group]", 
    separator: "[data-tree-separator]", 
    section: "[data-tree-section]:not([hidden])", 
    item: "[data-tree-item]", 
    parent: "[data-tree-item-parent]", 
    expander: "[data-tree-expander]", 
    itemClickTarget: "[data-tree-item-click-target]" 
};  
selectors.tree.expandedParent = selectors.tree.parent + ".expanded";
selectors.tree.expandedGroup = selectors.tree.group + ".expanded";
selectors.tree.expandedItem = selectors.tree.expandedGroup + ">"
    + selectors.tree.item;
selectors.tree.visibleItems = selectors.tree.section + ">" + selectors.tree.group + ">"
    + selectors.tree.item + "," + selectors.tree.expandedGroup + ">"
    + selectors.tree.item;
selectors.tree.sectionOrSeperator =  selectors.tree.separator + "," + selectors.tree.section; 

// Log (e.g. console panel output)

selectors.log = {
    row: "[data-log-row]",
    rowObject: "[data-log-row-object]",
    group: "[data-log-group]"
};

// Toolbar

selectors.toolbar = {
    group: "[data-toolbar]",
  // TODO: /deep/ is deprecated, alternative?
    item: "* /deep/ [data-toolbar-item]"
}

WebInspector.KeyboardAccessibility.selectors = selectors;


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
    return WebInspector.KeyboardAccessibility.matches(node, WebInspector.KeyboardAccessibility.selectors.util.resetFocus);
};

WebInspector.KeyboardAccessibility.matches = function(node, ...selector) {
    if (!node || !node.matches) {
        return null;
    }
    selector = selector.join(",");
    return node.matches(selector);
};

WebInspector.KeyboardAccessibility.focus = function(node, roving, oldNode)
{
    //console.log("focus %o", node);
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
