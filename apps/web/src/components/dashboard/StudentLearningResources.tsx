import React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CalendarDays,
  Store,
} from "lucide-react";
import learningTogetherImage from "../../assets/dashboard/students-learning-together.webp";

const STUDENT_RESOURCES = [
  {
    title: "How scenarios work",
    category: "Simulation basics",
    description: "Know what to expect before your first challenge begins.",
    href: "https://scalelxp.com/docs/students/scenarios",
    icon: CalendarDays,
    iconClass: "bg-brand-blue/10 text-brand-blue",
  },
  {
    title: "Stores and store types",
    category: "Your business",
    description: "See how your shop type shapes costs and capacity.",
    href: "https://scalelxp.com/docs/students/store-and-store-types",
    icon: Store,
    iconClass: "bg-brand-orange/10 text-brand-orange",
  },
  {
    title: "What is a unit?",
    category: "Inventory basics",
    description: "Learn the building block behind every inventory decision.",
    href: "https://scalelxp.com/docs/students/what-is-a-unit",
    icon: Boxes,
    iconClass: "bg-brand-teal/15 text-brand-blue",
  },
] as const;

const StudentLearningResources: React.FC = () => {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-brand-blue/15 bg-ui-surface shadow-sm"
      aria-labelledby="student-library-title"
    >
      <div className="flex flex-col md:flex-row">
        <div className="relative overflow-hidden bg-brand-blue md:w-1/2">
          <img
            src={learningTogetherImage}
            alt="College students studying business concepts together in a classroom"
            className="block min-h-72 w-full object-cover md:min-h-[28rem]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-brand-blue via-brand-blue/15 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/30 bg-brand-blue/65 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] backdrop-blur-sm">
              <BookOpen className="size-3.5" aria-hidden />
              SCALE LXP student library
            </div>
            <h2
              id="student-library-title"
              className="mt-4 max-w-md text-2xl font-bold leading-tight md:text-3xl"
            >
              Build your business playbook
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/85">
              Short, practical guides for making confident decisions in class.
            </p>
          </div>
        </div>

        <div className="flex flex-col p-5 md:w-1/2 md:p-7 xl:p-8">
          <div className="flex flex-col gap-3 border-b border-ui-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-brand-orange">
                Start here
              </div>
              <h3 className="mt-1 text-xl font-bold text-text-primary">
                Three quick reads
              </h3>
            </div>
            <a
              href="https://scalelxp.com/docs/students"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-brand-blue transition-colors hover:text-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2 sm:self-auto"
              aria-label="View all student guides on SCALE LXP (opens in a new tab)"
            >
              Browse all guides
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>

          <div className="mt-2 flex flex-1 flex-col divide-y divide-ui-border">
            {STUDENT_RESOURCES.map((resource) => {
              const ResourceIcon = resource.icon;
              return (
                <a
                  key={resource.href}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/resource -mx-2 flex flex-1 items-center gap-4 rounded-xl px-2 py-4 transition-colors hover:bg-ui-muted/45 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-inset md:px-3"
                  aria-label={`${resource.title} on SCALE LXP (opens in a new tab)`}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${resource.iconClass}`}
                  >
                    <ResourceIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                      {resource.category}
                    </div>
                    <h4 className="mt-0.5 text-sm font-bold text-text-primary transition-colors group-hover/resource:text-brand-blue md:text-base">
                      {resource.title}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-text-muted md:text-sm">
                      {resource.description}
                    </p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ui-border text-text-muted transition-all group-hover/resource:border-brand-teal/50 group-hover/resource:bg-brand-teal/10 group-hover/resource:text-brand-blue">
                    <ArrowRight
                      className="size-4 transition-transform group-hover/resource:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudentLearningResources;
