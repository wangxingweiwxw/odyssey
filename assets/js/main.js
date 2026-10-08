/**
 * ============================================
 * 数字博物馆 - 全局通用 JavaScript
 * 功能：导航交互、滚动动画、轮播图、返回顶部
 * ============================================
 */
'use strict';

(function () {
    /**
     * 导航栏滚动效果 - 背景色渐变
     */
    function initNavScroll() {
        var navbar = document.querySelector('.navbar');
        if (!navbar) return;

        window.addEventListener('scroll', function () {
            if (window.scrollY > 60) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    /**
     * 移动端菜单切换
     */
    function initMobileMenu() {
        var toggle = document.querySelector('.navbar-toggle');
        var menu = document.querySelector('.navbar-menu');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', function () {
            toggle.classList.toggle('open');
            menu.classList.toggle('open');
        });

        // 点击导航链接后关闭移动端菜单
        var links = menu.querySelectorAll('.nav-link, .dropdown-menu a');
        links.forEach(function (link) {
            link.addEventListener('click', function () {
                toggle.classList.remove('open');
                menu.classList.remove('open');
            });
        });
    }

    /**
     * 轮播图功能
     * 自动播放 + 手动切换（上一张/下一张/指示点）
     */
    function initCarousel() {
        var carousel = document.querySelector('.carousel');
        if (!carousel) return;

        var slides = carousel.querySelectorAll('.carousel-slide');
        var indicators = carousel.querySelectorAll('.carousel-indicator');
        var prevBtn = carousel.querySelector('.carousel-btn.prev');
        var nextBtn = carousel.querySelector('.carousel-btn.next');
        var current = 0;
        var autoPlayTimer = null;
        var autoPlayInterval = 5000;

        function goTo(index) {
            if (index < 0) index = slides.length - 1;
            if (index >= slides.length) index = 0;

            slides[current].classList.remove('active');
            if (indicators[current]) {
                indicators[current].classList.remove('active');
            }

            current = index;
            slides[current].classList.add('active');
            if (indicators[current]) {
                indicators[current].classList.add('active');
            }
        }

        function next() {
            goTo(current + 1);
        }

        function prev() {
            goTo(current - 1);
        }

        function startAutoPlay() {
            stopAutoPlay();
            autoPlayTimer = setInterval(next, autoPlayInterval);
        }

        function stopAutoPlay() {
            if (autoPlayTimer) {
                clearInterval(autoPlayTimer);
                autoPlayTimer = null;
            }
        }

        // 按钮事件
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                next();
                startAutoPlay();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                prev();
                startAutoPlay();
            });
        }

        // 指示点事件
        indicators.forEach(function (dot, index) {
            dot.addEventListener('click', function () {
                goTo(index);
                startAutoPlay();
            });
        });

        // 鼠标悬停暂停
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);

        // 触摸滑动支持
        var touchStartX = 0;
        var touchEndX = 0;

        carousel.addEventListener('touchstart', function (e) {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        carousel.addEventListener('touchend', function (e) {
            touchEndX = e.changedTouches[0].screenX;
            var diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    next();
                } else {
                    prev();
                }
            }
            startAutoPlay();
        }, { passive: true });

        // 启动自动播放
        startAutoPlay();
    }

    /**
     * 滚动淡入上浮动画 - 使用 IntersectionObserver
     */
    function initScrollAnimation() {
        var elements = document.querySelectorAll('.animate-on-scroll');
        if (elements.length === 0) return;

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.15,
                rootMargin: '0px 0px -50px 0px'
            });

            elements.forEach(function (el) {
                observer.observe(el);
            });
        } else {
            // 降级方案：直接显示
            elements.forEach(function (el) {
                el.classList.add('visible');
            });
        }
    }

    /**
     * 数字计数动画
     */
    function initCounter() {
        var counters = document.querySelectorAll('.stat-number');
        if (counters.length === 0) return;

        function animateCounter(el) {
            var target = parseInt(el.getAttribute('data-target'), 10);
            var duration = 2000;
            var startTime = null;

            function update(timestamp) {
                if (!startTime) startTime = timestamp;
                var progress = Math.min((timestamp - startTime) / duration, 1);
                // easeOutQuart 缓动函数
                var eased = 1 - Math.pow(1 - progress, 4);
                el.textContent = Math.floor(eased * target).toLocaleString();
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    el.textContent = target.toLocaleString();
                }
            }

            requestAnimationFrame(update);
        }

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        animateCounter(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            counters.forEach(function (c) {
                observer.observe(c);
            });
        } else {
            counters.forEach(function (c) {
                c.textContent = c.getAttribute('data-target');
            });
        }
    }

    /**
     * 返回顶部按钮
     */
    function initBackToTop() {
        var btn = document.querySelector('.back-to-top');
        if (!btn) return;

        window.addEventListener('scroll', function () {
            if (window.scrollY > 400) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        });

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /**
     * 表单校验 - 留言表单
     */
    function initFormValidation() {
        var form = document.querySelector('#contact-form');
        if (!form) return;

        var nameInput = form.querySelector('#name');
        var emailInput = form.querySelector('#email');
        var messageInput = form.querySelector('#message');
        var charCount = form.querySelector('.char-count');
        var successMsg = form.querySelector('.success-message');

        // 实时字数统计
        if (messageInput && charCount) {
            messageInput.addEventListener('input', function () {
                var len = messageInput.value.length;
                charCount.textContent = len + ' / 20+ 字';
                if (len < 20) {
                    charCount.classList.add('warning');
                } else {
                    charCount.classList.remove('warning');
                }
            });
        }

        // 显示错误
        function showError(input, errorId) {
            input.classList.add('error');
            var errorEl = form.querySelector('#' + errorId);
            if (errorEl) errorEl.classList.add('show');
        }

        // 清除错误
        function clearError(input, errorId) {
            input.classList.remove('error');
            var errorEl = form.querySelector('#' + errorId);
            if (errorEl) errorEl.classList.remove('show');
        }

        // 邮箱格式校验正则
        var emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        // 失焦时即时校验
        if (nameInput) {
            nameInput.addEventListener('blur', function () {
                if (nameInput.value.trim() === '') {
                    showError(nameInput, 'name-error');
                } else {
                    clearError(nameInput, 'name-error');
                }
            });
        }

        if (emailInput) {
            emailInput.addEventListener('blur', function () {
                if (!emailRegex.test(emailInput.value.trim())) {
                    showError(emailInput, 'email-error');
                } else {
                    clearError(emailInput, 'email-error');
                }
            });
        }

        if (messageInput) {
            messageInput.addEventListener('blur', function () {
                if (messageInput.value.trim().length < 20) {
                    showError(messageInput, 'message-error');
                } else {
                    clearError(messageInput, 'message-error');
                }
            });
        }

        // 提交校验
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var isValid = true;

            // 校验姓名
            if (nameInput && nameInput.value.trim() === '') {
                showError(nameInput, 'name-error');
                isValid = false;
            } else if (nameInput) {
                clearError(nameInput, 'name-error');
            }

            // 校验邮箱
            if (emailInput && !emailRegex.test(emailInput.value.trim())) {
                showError(emailInput, 'email-error');
                isValid = false;
            } else if (emailInput) {
                clearError(emailInput, 'email-error');
            }

            // 校验留言内容
            if (messageInput && messageInput.value.trim().length < 20) {
                showError(messageInput, 'message-error');
                isValid = false;
            } else if (messageInput) {
                clearError(messageInput, 'message-error');
            }

            if (isValid) {
                // 显示成功提示
                if (successMsg) {
                    successMsg.classList.add('show');
                    successMsg.textContent = '留言提交成功！感谢您的反馈，我们会尽快与您联系。';
                }

                // 重置表单
                form.reset();
                if (charCount) {
                    charCount.textContent = '0 / 20+ 字';
                    charCount.classList.add('warning');
                }

                // 滚动到提示
                if (successMsg) {
                    successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                // 3秒后隐藏提示
                setTimeout(function () {
                    if (successMsg) successMsg.classList.remove('show');
                }, 5000);
            }
        });
    }

    /**
     * 标签页切换 - 传承人页面
     */
    function initTabs() {
        var tabBtns = document.querySelectorAll('.tab-btn');
        var tabContents = document.querySelectorAll('.tab-content');
        if (tabBtns.length === 0) return;

        tabBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = btn.getAttribute('data-tab');

                // 移除所有激活状态
                tabBtns.forEach(function (b) { b.classList.remove('active'); });
                tabContents.forEach(function (c) { c.classList.remove('active'); });

                // 激活当前标签
                btn.classList.add('active');
                var targetContent = document.querySelector('#' + target);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    /**
     * 设置当前导航高亮
     */
    function initActiveNav() {
        var path = window.location.pathname;
        var page = path.split('/').pop() || 'index.html';
        var navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href) return;

            var linkPage = href.split('/').pop();
            if (linkPage === page) {
                link.classList.add('active');
            }
        });
    }

    /**
     * 初始化所有功能
     */
    function init() {
        initNavScroll();
        initMobileMenu();
        initCarousel();
        initScrollAnimation();
        initCounter();
        initBackToTop();
        initFormValidation();
        initTabs();
        initActiveNav();
    }

    // DOM 加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
