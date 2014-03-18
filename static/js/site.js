var format = (function() {
    var re = /\{([^}]+)\}/g;
    return function(s, args) {
        if (!s) {
            throw "Format string is empty!";
        }
        if (!args) return;
        if (!(args instanceof Array || args instanceof Object))
            args = Array.prototype.slice.call(arguments, 1);
        return s.replace(re, function(_, match){ return args[match]; });
    };
})();

var trim = (function() {
    var length = 100;
    return function(s) {
        if (s.length > length) {
            return s.substring(0, length) + '...';
        }
        return s;
    };
})();

(function($) {
    var bug_re = /^.*\?id=(\d+)$/;
    if ($('#triages').length > 0) {
        $.getJSON('/api/', function(data) {
            for (var record in data.entries) {
                var key = data.entries[record];
                $('#triages tbody').append(
                    format('<tr><td><a href="/triage.html#{0}">{1}</a></td>' +
                           '<td>{2}</td></tr>', key, key,
                           (new Date(parseInt(key))).toString())
                );
            }
        });
    } else {
        var key = window.location.hash.substr(1);
        var URL = Backbone.Model.extend({
            initialize: function() {
                var bug_ = bug_re.exec(this.get('url'));
                this.set({
                    bug: bug_ ? bug_[1] : null
                });
            }
        });
        var URLs = Backbone.Collection.extend({
            model: URL
        });
        var URLsView = Backbone.View.extend({
            el: $('#urls tbody'),
            initialize: function() {
                var self = this;
                _.bindAll(this, 'render', 'appendItem');
                this.collection = new URLs();
                this.collection.bind('add', this.appendItem);

                $('#triage-id').text(key);
                $.getJSON('/api/' + key + '/', function(data) {
                    for (var record in data.entries) {
                        var url = new URL({
                            url: data.entries[record].url,
                            title: data.entries[record].title
                        });
                        self.collection.add(url);
                    }
                });
                var source = new EventSource('/api-events/' + key + '/');
                source.addEventListener('message', function(e) {
                    var json = JSON.parse(e.data);
                    var url = new URL({
                        url: json.url,
                        title: json.title
                    });
                    self.collection.add(url);
                }, false);

                this.render();
            },
            render: function() {
                var self = this;
                _(this.collection.models).each(function(item){
                    self.appendItem(item);
                }, this);
            },
            appendItem: function(item){
                var url = item.get('url');
                var title = item.get('title');
                var bug = item.get('bug');
                $('span.label-warning').remove();
                $(this.el).prepend(format(
                    '<tr><td><span class="label label-warning">latest</span> &nbsp; <span class="label label-{0}">{1}</span></td><td><a target="_blank" href="{2}">{3}</td></tr>',
                    bug ? 'success' : 'info', bug ? 'bug' : 'other', url, bug ? title : trim(url)
                ));
            }
        });
        var urlsView = new URLsView();

    }
})(jQuery);
