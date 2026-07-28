@@
     const token = authHeader.replace('Bearer ', '');
     if (!token) {
       throw new Error('Unauthorized: No token provided');
     }
-
-    if (token.split('.').length !== 3) {
-      throw new Error('Unauthorized: Invalid token');
-    }
+
+    // Defensive token structure check
+    if (typeof token !== 'string' || token.indexOf('.') === -1) {
+      throw new Error('Unauthorized: Invalid token');
+    }
+    if (token.split('.').length !== 3) {
+      throw new Error('Unauthorized: Invalid token');
+    }
*** End Patch
