define([
    'require',
    'flight/lib/component',
    'hbs!./searchTpl',
    'tpl!util/alert'
], function(
    require,
    defineComponent,
    template,
    alertTemplate) {
    'use strict';

    var SEARCH_TYPES = ['Lumify', 'Workspace'];

    return defineComponent(Search);

    function Search() {

        this.savedQueries = _.indexBy(SEARCH_TYPES.map(function(type) {
            return {
                type: type,
                query: '',
                filters: []
            }
        }), 'type');

        this.defaultAttrs({
            formSelector: '.navbar-search',
            querySelector: '.navbar-search .search-query',
            queryValidationSelector: '.search-query-validation',
            queryContainerSelector: '.search-query-container',
            clearSearchSelector: '.search-query-container a',
            segmentedControlSelector: '.segmented-control',
            filtersInfoSelector: '.filter-info',
            searchTypeSelector: '.search-type'
        });

        this.after('initialize', function() {
            this.render();
            this.triggerQueryUpdated = _.debounce(this.triggerQueryUpdated.bind(this), 500);

            this.on('click', {
                segmentedControlSelector: this.onSegmentedControlsClick,
                clearSearchSelector: this.onClearSearchClick
            });
            this.on('change keydown keyup paste', this.onQueryChange);
            this.on(this.select('querySelector'), 'focus', this.onQueryFocus);

            this.on('filterschange', this.onFiltersChange);
            this.on('searchRequestBegan', this.onSearchResultsBegan);
            this.on('searchRequestCompleted', this.onSearchResultsCompleted);
            this.on(document, 'searchPaneVisible', this.onSearchPaneVisible);
        });

        this.onSearchPaneVisible = function(event, data) {
            this.select('querySelector').focus();
        };

        this.onSearchResultsBegan = function() {
            this.select('queryContainerSelector').addClass('loading');
        };

        this.onSearchResultsCompleted = function(event, data) {
            this.select('queryContainerSelector').removeClass('loading');
            this.updateQueryError(data);
        };

        this.updateQueryError = function(data) {
            var $error = this.select('queryValidationSelector')

            this.$node.toggleClass('hasError', !!(data && !data.success));

            if (!data || data.success) {
                $error.empty();
            } else {
                $error.html(
                    alertTemplate({ error: data.error || 'Server error' })
                )
            }
        };

        this.onFiltersChange = function(event, data) {
            this.filters = data;

            var query = this.getQueryVal(),
                hasFilters = this.hasFilters();

            if (!query && hasFilters && data.setAsteriskSearchOnEmpty) {
                this.select('querySelector').val('*');
            }

            if (query || hasFilters) {
                this.triggerQueryUpdated();
                this.triggerQuerySubmit();
            }

            this.updateClearSearch();
        };

        this.onQueryChange = function(event) {
            if (event.which === $.ui.keyCode.ENTER) {
                if (event.type === 'keyup') {
                    this.triggerQuerySubmit();
                    $(event.target).select()
                }
            } else if (event.which === $.ui.keyCode.ESCAPE) {
                this.onClearSearchClick();
            } else {
                this.updateClearSearch();
                this.triggerQueryUpdated();
            }
        };

        this.onClearSearchClick = function(event) {
            var node = this.getSearchTypeNode(),
                $query = this.select('querySelector'),
                $clear = this.select('clearSearchSelector'),
                canClear = (event && event.type === 'click') || this.canClearSearch;

            this.select('queryContainerSelector').removeClass('loading');
            if (this.getQueryVal()) {
                this.setQueryVal('');
            }
            this.filters = null;
            this.updateQueryError();

            if (canClear) {
                $clear.hide();
                _.defer($query.focus.bind($query));
                this.trigger(node, 'clearSearch')
            } else {
                $query.blur();
            }
        };

        this.onSegmentedControlsClick = function(event, data) {
            event.stopPropagation();

            this.switchSearchType(
                $(event.target)
                    .blur()
                    .addClass('active')
                    .siblings('button').removeClass('active').end()
                    .data('type')
            );
            this.select('querySelector').focus();
        };

        this.onQueryFocus = function(event) {
            this.switchSearchType(this.searchType || SEARCH_TYPES[0]);
        };

        this.switchSearchType = function(newSearchType) {
            if (!newSearchType || this.searchType === newSearchType) {
                return;
            }

            this.updateQueryValue(newSearchType);

            var self = this,
                node = this.getSearchTypeNode()
                    .addClass('active')
                    .siblings('.search-type').removeClass('active').end();

            require(['./types/type' + newSearchType], function(SearchType) {
                SearchType.attachTo(node);

                self.trigger('searchtypeloaded', { type: newSearchType });
                self.trigger('paneResized');
            });
        };

        this.updateClearSearch = function() {
            this.canClearSearch = this.getQueryVal().length > 0 || this.hasFilters();
            this.select('clearSearchSelector').toggle(this.canClearSearch);
        }

        this.hasFilters = function() {
            return !!(this.filters && (
                !_.isEmpty(this.filters.conceptFilter) ||
                !_.isEmpty(this.filters.propertyFilters) ||
                !_.isEmpty(this.filters.entityFilters)
            ));
        };

        this.updateQueryValue = function(newSearchType) {
            var $query = this.select('querySelector');
            if (this.searchType) {
                this.savedQueries[this.searchType].query = $query.val();
            }
            this.searchType = newSearchType;

            $query.val(this.savedQueries[newSearchType].query);

            this.updateClearSearch();
        };

        this.triggerOnType = function(eventName) {
            var searchType = this.getSearchTypeNode();

            this.trigger(searchType, eventName, {
                value: this.getQueryVal(),
                filters: this.filters || {}
            });
        };

        this.triggerQuerySubmit = _.partial(this.triggerOnType, 'querysubmit');

        this.triggerQueryUpdated = _.partial(this.triggerOnType, 'queryupdated');

        this.getQueryVal = function() {
            return $.trim(this.select('querySelector').val());
        };

        this.setQueryVal = function(val) {
            this.select('querySelector').val(val).change();
        };

        this.getSearchTypeNode = function() {
            return this.$node.find('.search-type-' + this.searchType.toLowerCase());
        };

        this.render = function() {
            var self = this;

            this.$node.html(template({
                types: SEARCH_TYPES.map(function(type, i) {
                    return {
                        cls: type.toLowerCase(),
                        name: type,
                        selected: i === 0
                    }
                }),
            }));
        };
    }
});
