allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Make every plugin (e.g. jni) use the NDK installed on this machine instead of
// Flutter's default 28.2, whose download keeps stalling.
val pinnedNdkVersion = "30.0.16248370"
subprojects {
    val pinNdk: Project.() -> Unit = {
        extensions.findByName("android")?.let { ext ->
            runCatching {
                ext.javaClass.getMethod("setNdkVersion", String::class.java).invoke(ext, pinnedNdkVersion)
            }
        }
    }
    if (state.executed) pinNdk() else afterEvaluate { pinNdk() }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
