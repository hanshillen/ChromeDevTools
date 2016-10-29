// Copyright (c) 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @constructor
 * @extends {WebInspector.Object}
 * @param {!Document} doc
 */
WebInspector.KeyboardManager = function(doc)
{
    doc.addEventListener("keydown", this._handleGlobalKeyDown.bind(this), true);

    // TODO: come up with elegant way for proper keyboard support for context
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

WebInspector.KeyboardManager.prototype = {
    
    /**
     * @type {boolean} 
     */
    enableA11y: true,

    /* Global navigation methods */

    /**
     * @param {!Event} event
     */
    _handleGlobalKeyDown: function(event)
    {
        /*
         * only handle nodes and keys commonly used for navigation
         */
        var target = WebInspector.currentFocusElement()
        if (!target || !target.dataset || target.dataset.keyNav === undefined
                || this._keys.navKeys.indexOf(event.keyCode) === -1) {
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
    
    /**
     * @param {!Event} event
     * @return {Object} keyInfo
     */
    _getKeyInformation: function(event)
    {
        var keyInfo = {
            isArrow: this._keys.arrowKeys.indexOf(event.keyCode) !== -1,
            isVertical: this._keys.verticalKeys.indexOf(event.keyCode) !== -1,
            isHorizontal: this._keys.horizontalKeys.indexOf(event.keyCode) !== -1,
            isEdge: this._keys.edgeKeys.indexOf(event.keyCode) !== -1,
            isPage: this._keys.pageKeys.indexOf(event.keyCode) !== -1,
            isForward: this._keys.forwardKeys.indexOf(event.keyCode) !== -1,
            isItemScope: this._keys.arrowKeys.indexOf(event.keyCode) !== -1,
            isGroupScope: event.ctrlKey,
            isSectionScope: event.ctrlKey && event.shiftKey,
            isEnter: event.keyCode === this._keys.enterKey,
            isSpace: event.keyCode === this._keys.spaceKey
        };
        keyInfo.scope = (keyInfo.isSectionScope ? "section"
                : (keyInfo.isGroupScope ? "group" : "item"));
        return keyInfo;
    },
    
    /**
     * @param {Node} startNode
     * @param {!String} selector
     * @param {!boolean} isForward
     * @return {?Node}
     */
    _findSibling: function(startNode, selector, isForward)
    {
        if (!startNode) {
            return null;
        }
        var node = startNode;
        while (node = isForward ? node.nextElementSibling : node.previousElementSibling) {
            if (this.matches(node, selector)) {
                break;
            }
        }
        return node;
    },

    /**
     * @param {!Node} startNode
     * @param {!String} selector
     * @param {!boolean} isForward
     * @param {!(Node|string)} [parentNodeOrSelector]
     * @param {number} [skipNumber=1]
     * @return {Node}
     */
    _findSiblingByIndex: function(startNode, selector, isForward, parentNodeOrSelector, skipNumber)
    {
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
    
    /**
     * @param {!Node} startNode
     * @param {!string} selector
     * @return {?Node}
     */
    _findFirstSibling: function(startNode, selector) {
        if (!startNode) {
            return null;
        }
        var node = startNode.parentNode.firstChild;
        do {
            if (this.matches(node, selector)) {
                break
            }
        } while (node = node.nextSibling);
        return node;
    },
    
    /**
     * @param {!Node} startNode
     * @return {?Node}
     */
    _findFirstExpandedChild: function(startNode)
    {
        var groupNode = this._findSibling(startNode,
                this._selectors.tree.expandedGroup, true);
        return this._query(groupNode, this._selectors.tree.item);
    },

    /**
     * @param {!Node} node
     * @return {?Node} 
     */
    _findExpandedParent: function(node)
    {
        return this._findSibling(this._findClosest(node,
                this._selectors.tree.group), this._selectors.tree.expandedParent, false);
    },
    
    /**
     * @param {!Node} node
     * @param {...string} selector
     * @return {boolean} 
     */
    matches: function(node, ...selector)
    {
        if (!node || !node.matches) {
            return null;
        }
        selector = selector.join(",");
        return node.matches(selector);
    },
    
    /**
     * @param {!Node} node
     * @param {string} selector
     * @param {boolean} useOffsetParent
     * @return {?Node} 
     */
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
    
    /**
     * @param {!Node} node
     * @param {string} selector
     * @return {?Node} 
     */
    _query: function(node, selector)
    {
        if (!node || !node.querySelector) {
            return null;
        }
        return node.querySelector(selector);
    },
    
    /**
     * @param {!Node} node
     * @param {string} selector
     * @return {?Node} 
     */
    _queryLast: function(node, selector)
    {
        var nodes = this._queryAll(node, selector);
        return nodes && nodes.length ? nodes.item(nodes.length - 1) : null;
    },
    
    /**
     * @param {!Node} node
     * @param {string} selector
     * @return {NodeList} 
     */
    _queryAll: function(node, selector)
    {
        if (!node || !node.querySelectorAll) {
            return null;
        }
        return node.querySelectorAll(selector);
    },
    
    /**
     * @param {!Node} node
     * @param {string} outerSelector
     * @param {string} innerSelector
     * @return {?Node} 
     */
    _shadowQuery: function(node, outerSelector, innerSelector)
    {
        var shadowHost = this._query(node, outerSelector);
        if (!shadowHost || !shadowHost.shadowRoot) {
            return null;
        }
        return shadowHost.shadowRoot.querySelector(innerSelector);
    },

    /**
     * @param {Node} node
     */
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

    /**
     * @param {Event} event
     * @param {Node} target
     */
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
            this.focus(foundNode);
        }
    },

    /* log rows navigation */

    /**
     * @param {Event} event
     * @param {Node} target
     */
    _logHandleNavigation: function(event, target) {
        var foundNode;
        var keyInfo = this._getKeyInformation(event);
        var keys = WebInspector.KeyboardShortcut.Keys;

        if (this.matches(target, this._selectors.log.row) || this.matches(target, this._selectors.log.rowObject)) {
            if ((keyInfo.isArrow && keyInfo.isVertical) || keyInfo.isPage) {
                let rowSelector = this._selectors.log.row;
                foundNode = this._findSiblingByIndex(this._findClosest(target, rowSelector), rowSelector, keyInfo.isForward, this._selectors.log.group, keyInfo.isPage ? 10 : 1);
            } else if (keyInfo.isArrow && keyInfo.isHorizontal) {
                foundNode = this._logHandleHorizontalNav(target, keyInfo, false);
            }
        }
        if (this.matches(target, this._selectors.log.row)) {
            // TODO: Home & End currently don't work correctly because only the
            // visible log rows are actually in the DOM
            if (keyInfo.isEdge) {
                let logGroup = this._findClosest(target, this._selectors.log.group);
                foundNode = this[keyInfo.isForward ? "_queryLast" : "_query"](logGroup, this._selectors.log.row);
            }
        } else if (this.matches(target, this._selectors.log.rowObject)) {
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
            this.focus(foundNode);
        }
    },

    /**
     * @param {Event} event
     * @param {Object} keyInfo
     * @param {boolean} isEdge
     * @return {?Node}
     */
    _logHandleHorizontalNav: function(target, keyInfo, isEdge) {
        var foundNode;
        if (this.matches(target, this._selectors.log.row) && keyInfo.isForward) {
            foundNode = this._query(target, this._selectors.log.rowObject);
        } else if (this.matches(target, this._selectors.log.rowObject)) {
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
    
    /**
     * @param {Event} event
     * @param {Node} target
     */
    _tabsHandleNavigation: function(event, target) {
        var foundNode;
        var keys = WebInspector.KeyboardShortcut.Keys;
        switch(event.keyCode) {
            case keys.Left.code:
            case keys.Up.code:
                foundNode = this._findSibling(target, this._selectors.tabs.tab, false);
                event.consume(true);
                break;
            case keys.Right.code:
            case Keys.Down.code:
                foundNode = this._findSibling(target, this._selectors.tabs.tab, true);
                event.consume(true);
                break;
            case keys.Enter.code:
                this._click(target);
                break
        }
        if (foundNode) {
            this.focus(foundNode);
        }
    },

    /* Tree widget navigation */
    
    /**
     * @param {Event} event
     * @param {Node} target
     */
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
            this.focus(foundNode);
        }
    },

    /**
     * @param {Event} event
     * @param {Object} keyInfo
     * @return {?Node}
     */
    _treeHandleVerticalNav: function(target, keyInfo) {
        var foundNode = null;
        switch (keyInfo.scope) {
        case "item":
            if (this.matches(target, this._selectors.tree.item)) {
                foundNode = this._findAdjacentTreeItem(target,
                        keyInfo.isForward);
            } else if (this.matches(target, this._selectors.tree.groupTitle)) {
                foundNode = this._findAdjacentTreeItemFromTitle(target,
                        keyInfo.isForward);

                if (!foundNode) {
                    // empty ruleset
                    foundNode = this._findAdjacentTreeSectionTitle(target,
                            keyInfo.isForward, true);
                }
            } else if (this.matches(target, this._selectors.tree.separator)) {
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

    /**
     * @param {Node} startNode
     * @param {boolean} isForward
     * @return {?Node}
     */
    _findAdjacentTreeItem: function(startNode, isForward)
    {
        var groupNode, foundNode;
        var branch = this._findClosest(startNode, this._selectors.tree.group);
        if (!branch) {
            return null;
        }
        // 1. Attempt navigation between declarations inside ruleset
        if (!this.matches(branch, this._selectors.tree.group)) {
            if (isForward
                    && this.matches(startNode, this._selectors.tree.expandedParent)) {
                foundNode = this._findFirstExpandedChild(startNode,
                        this._selectors.tree.expandedGroup);
            } else {
                foundNode = this._findSibling(startNode,
                        this._selectors.tree.item, isForward);
            }
            if (foundNode && !isForward
                    && this.matches(foundNode, this._selectors.tree.expandedParent)) {
                groupNode = this._findSibling(foundNode,
                        this._selectors.tree.expandedGroup, true);
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
    
    /**
     * @param {Node} startNode
     * @return {?Node}
     */
    _findCurrentTreeSectionTitle: function(startNode)
    {
        var parent;
        parent = this._findClosest(startNode, this._selectors.tree.section);
        return this._query(parent, this._selectors.tree.groupTitle);
    },
    
    /**
     * @param {Node} startNode
     * @param {boolean} isforward
     * @return {?Node}
     */
    _findAdjacentTreeSectionTitle: function(startNode, isForward,
            extendPastSeparator)
    {
        var selector = !extendPastSeparator ? this._selectors.tree.sectionOrSeperator
                : this._selectors.tree.section;
        var parent, adjacentNode, foundNode;
        var includeSelf = this.matches(startNode, this._selectors.tree.item);
        parent = this._findClosest(startNode, this._selectors.tree.sectionOrSeperator);
        if (!isForward && includeSelf) {
            adjacentNode = this._query(parent, this._selectors.tree.groupTitle);
        } else {
            adjacentNode = this._findSibling(parent, selector, isForward);
        }
        if (!adjacentNode || this.matches(adjacentNode, this._selectors.tree.separator)) {
            return null;
        }
        return this._findCurrentTreeSectionTitle(adjacentNode);
    },
    
    /**
     * @param {Node} startNode
     * @param {boolean} isforward
     * @return {?Node}
     */
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
    
    /**
     * @param {Node} startNode
     * @param {boolean} isforward
     * @return {?Node}
     */
    _findAdjacentTreeItemFromTitle: function(startNode, isForward)
    {
        var group, foundNode;
        if (isForward) {
            group = this._findSibling(startNode, this._selectors.tree.group, true);
            foundNode = this._query(group, this._selectors.tree.item);
        } else {
            group = this._findSibling(this._findClosest(startNode,
                    this._selectors.tree.section), this._selectors.tree.sectionOrSeperator, false);
            foundNode = this.matches(group, this._selectors.tree.separator) ? group
                    : this._queryLast(group, this._selectors.tree.visibleItems);
        }
        return foundNode;
    },
    
    /**
     * @param {Node} startNode
     * @param {boolean} isforward
     * @return {?Node}
     */
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
    
    /**
     * @param {Node} startNode
     * @param {Object} keyInfo
     * @return {?Node}
     */
    _treeHandleHorizontalNav: function(target, keyInfo) {
        var foundNode = null;
        if (this.matches(target, this._selectors.tree.parent)) {
            if (keyInfo.isForward) {
                if (!this.matches(target, this._selectors.tree.expandedParent)) {
                    this._click(this._query(target,
                            this._selectors.tree.expander));
                } else {
                    foundNode = this._findFirstExpandedChild(target,
                            this._selectors.tree.expandedGroup);
                }
            } else if (!keyInfo.isForward
                    && this.matches(target, this._selectors.tree.expandedParent)) {
                this._click(this._query(target, this._selectors.tree.expander));
            }
        } else if (this.matches(target, this._selectors.tree.expandedItem)
                && !keyInfo.isForward) {
            foundNode = this._findExpandedParent(target);
        }
        return foundNode;
    },
    
    /**
     * @param {Node} target
     */
    _treeHandleEnter: function(target) {
        if (this.matches(target, this._selectors.tree.item, this._selectors.tree.groupTitle)) {
            this.markAsRefocus(target);
            this._click(this._query(target, this._selectors.tree.itemClickTarget));
        } else if (this.matches(target, this._selectors.tree.separator)) {
            this._click(this._shadowQuery(target, this._selectors.util.shadowHost, this._selectors.util.shadowClickTarget));
        }
    },
    
    /**
     * @param {Node} target
     */
    _treeHandleSpace: function(target) {
        this.markAsRefocus(target);
        this._click(this._query(target, this._selectors.util.toggle));
    },

    /* public */
    
    /**
     * @param {Node} node
     * @param {boolean} roving
     * @param {Node} [oldNode]
     * @return {boolean}
     */
    focus: function(node, roving, oldNode) {
        // console.log("focus %o", node);
        if (!this.enableA11y) {
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
    },

    /**
     * @param {Node} node
     */
    markAsRefocus: function(node) {
        if (!node || !node.dataset) {
            return;
        }
        node.dataset.resetFocus = true;
    },

    /**
     * @param {Node} node
     */
    unmarkAsRefocus: function(node) {
        if (!node || !node.dataset) {
            return;
        }
        delete node.dataset.resetFocus;
    },

    /**
     * @param {Node} node
     * @return {boolean}
     */
    isMarkedForRefocus: function(node) {
        return this.matches(node, this._selectors.util.resetFocus);
    },
    
    /**
     * @param {Node} node
     * @param {?string} keyNavType
     * @param {?string[]} [dataset]
     * @param {number} [tabIndex]
     */
    registerNode: function(node, keyNavType, dataset, tabIndex) {
        if (!node || !node.dataset ) {
            return null;
        }
        if (keyNavType) {
            node.dataset.keyNav = keyNavType;
        }
        if (dataset) {
            for (dataAttribute of dataset) {
                node.dataset[dataAttribute] = '';
            }    
        }
        var makeFocusable = tabIndex !== undefined;
        if (makeFocusable) {
            node.tabIndex = tabIndex;
        }  
    }
};

WebInspector.KeyboardManager.setProperties = function() {
    var prototype = WebInspector.KeyboardManager.prototype;
    var keys = WebInspector.KeyboardShortcut.Keys;
    prototype._keys = {
        arrowKeys: [keys.Up.code, keys.Down.code, keys.Left.code, keys.Right.code],
        edgeKeys: [keys.Home.code, keys.End.code],
        pageKeys: [keys.PageUp.code, keys.PageDown.code],
        forwardKeys: [ keys.Down.code, keys.Right.code, keys.PageDown.code, keys.End.code ],
        spaceKey: keys.Space.code,
        enterKey: keys.Enter.code,
        horizontalKeys: [ keys.Left.code, keys.Right.code ]
    };
    prototype._keys.verticalKeys = prototype._keys.pageKeys.
        concat(prototype._keys.edgeKeys, [keys.Up.code, keys.Down.code]);
    prototype._keys.navKeys = prototype._keys.verticalKeys.
        concat(prototype._keys.horizontalKeys, [keys.Tab.code, keys.Enter.code, keys.Space.code]);


    /** SELECTORS * */
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
    WebInspector.KeyboardManager.prototype._selectors = selectors;
};

WebInspector.KeyboardManager.setProperties();

